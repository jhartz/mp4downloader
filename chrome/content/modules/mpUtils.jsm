/*
    Copyright (C) 2016  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var EXPORTED_SYMBOLS = ["mpUtils"];

Cu.import("resource://gre/modules/Services.jsm");


// Holds loaded string bundles
var bundles = {};

// Find and import MP4 Downloader site modules
Cu.import("chrome://mp4downloader/content/modules/sites.jsm");
var siteModulesByName = {};
var siteModules = sites.map(function (site) {
    Cu.import("chrome://mp4downloader/content/modules/sites/" + site + ".jsm", siteModulesByName);
    return siteModulesByName[site];
});

// Our pref branch
var prefBranch = Services.prefs.getBranch("extensions.mp4downloader."),
    defaultPrefBranch = Services.prefs.getDefaultBranch("extensions.mp4downloader.");


var mpUtils = {
    // Easy pref access
    prefs: {
        getIntPref: (name) => prefBranch.getIntPref(name),
        setIntPref: (name, value) => prefBranch.setIntPref(name, value),
        
        getBoolPref: (name) => prefBranch.getBoolPref(name),
        setBoolPref: (name, value) => prefBranch.setBoolPref(name, value),
        
        // These should handle Unicode properly
        getStringPref: (name) => {
            return prefBranch.getComplexValue(name, Ci.nsISupportsString).data;
        },
        setStringPref: (name, value) => {
            let string = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            string.data = value;
            prefBranch.setComplexValue(name, Ci.nsISupportsString, string);
        },
        
        setDefaultPref: (name, value) => {
            switch (typeof value) {
                case "number":
                    defaultPrefBranch.setIntPref(name, value);
                    return;
                case "boolean":
                    defaultPrefBranch.setBoolPref(name, value);
                    return;
                case "string":
                    let string = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                    string.data = value;
                    defaultPrefBranch.setComplexValue(name, Ci.nsISupportsString, string);
                    return;
            }
        }
    },
    
    // Access to site module instances
    siteModules: siteModules,
    siteModulesByName: siteModulesByName,
    
    /**
     * Log an error or message.
     */
    log: function (msg) {
        if (!msg) return;
        Services.console.logStringMessage("MP4 Downloader:\n" + msg);
    },
    
    /**
     * Show an error or message.
     */
    alert: function (msg) {
        if (!msg) return;
        Services.prompt.alert(null, "MP4 Downloader", msg);
    },
    
    /**
     * Show a yes/no dialog.
     */
    confirm: function (msg) {
        if (!msg) return;
        return Services.prompt.confirmEx(null, "MP4 Downloader", msg, Services.prompt.STD_YES_NO_BUTTONS, null, null, null, null, {}) == 0;
    },
    
    /**
     * Create a site error object for later reporting.
     * (used by Video Site Modules)
     */
    createSiteError: function (localizedMsg, extraData) {
        let err = new Error(localizedMsg);
        err.mp4downloaderSiteError = true;
        err.mp4downloaderExtraData = extraData;
        return err;
    },
    
    /**
     * Show and optionally report an error message.
     */
    error: function (msg, extradata) {
        this.alert(msg + "\n\n" + this.getString("mp4downloader", "reportmsg"));
        // NOTE: below is if someday we get an online automatic error reporting system in place
        /*
        var browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
        if (!browserWindow) {
            this.alert(msg);
        } else {
            if (this.confirm(msg + "\n\n" + this.getString("mp4downloader", "reportmsg"))) {
                // Open new tab with contact page and attempt to pre-fill some data (including extradata)
                var t = browserWindow.gBrowser.addTab("http://mp4downloader.mozdev.org/drupal/contact");
                browserWindow.gBrowser.selectedTab = t;
                var tab = browserWindow.gBrowser.getBrowserForTab(t);
                var applied = false;
                tab.addEventListener("load", function () {
                    try {
                        if (!applied) {
                            tab.contentDocument.getElementById("edit-message").value = msg + (extradata ? "\n\n" + extradata : "");
                            applied = true;
                        }
                    } catch (err) {}
                }, true);
            }
        }
        */
    },
    
    /**
     * Get a string from a string bundle, optionally from a formatted string.
     */
    getString: function (bundlename, name, formats, isGlobal) {
        if (!bundles.hasOwnProperty(bundlename)) {
            let bundleURI = isGlobal ? bundlename :
                    "chrome://mp4downloader/locale/" + bundlename + ".properties";
            
            // From MDN:
            // https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless#Step_10_Bypass_cache_when_loading_properties_files
            /* HACK: The string bundle cache is cleared on addon shutdown, however it doesn't appear to do so reliably.
               Errors can erratically happen on next load of the same file in certain instances. (at minimum, when strings are added/removed)
               The apparently accepted solution to reliably load new versions is to always create bundles with a unique URL so as to bypass the cache.
               This is accomplished by passing a random number in a parameter after a '?'. (this random ID is otherwise ignored)
               The loaded string bundle is still cached on startup and should still be cleared out of the cache on addon shutdown.
               This just bypasses the built-in cache for repeated loads of the same path so that a newly installed update loads cleanly. */
            bundles[bundlename] = Services.strings.createBundle(bundleURI + "?" + Math.random());
        }
        let bundle = bundles[bundlename];
        try {
            if (formats) {
                return bundle.formatStringFromName(name, formats, formats.length);
            } else {
                return bundle.GetStringFromName(name);
            }
        } catch (err) {
            return "STRING ERROR " + JSON.stringify([bundlename, name, formats]);
        }
    },
    
    /**
     * Get a specific portion of a string starting from a certain string and (optionally) ending at a certain string.
     */
    getFromString: function (theString, beginStr, endStr) {
        if (typeof theString == "string" && beginStr && theString.indexOf(beginStr) != -1) {
            let fixedString = theString.substring(theString.indexOf(beginStr) + beginStr.length);
            if (endStr && fixedString.indexOf(endStr) != -1) {
                fixedString = fixedString.substring(0, fixedString.indexOf(endStr));
            }
            return fixedString;
        } else {
            // TODO: should we return null? Empty string? something else?
            return false;
        }
    },
    
    /**
     * Replaces vars and parses if statements in a specially-formatted string.
     */
    parseString: function (str, vars) {
        // Syntax explanation: http://jhartz.github.io/mp4downloader/docs/selective-content-replacement.html
        if (!str) str = "";
        if (!vars) vars = {};
        
        // Make sure vars are strings
        for (var v in vars) {
            if (vars.hasOwnProperty(v)) {
                if (typeof vars[v] != "string") {
                    vars[v] = vars[v].toString();
                }
            }
        }
        
        // Parse "if" statements
        // (not needed if we have no vars, so test if the vars serialize to {} - if we have native JSON)
        if ((typeof JSON == "undefined" || JSON.stringify(vars) != "{}") && str.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[endif\]\]/)) {
            var isRunning = true, newStr = "", ifStr = "", ifMatch;
            do {
                if (str.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[endif\]\]/)) {
                    // Add stuff before if statement to newStr, cut it off str, add if statement to ifStr, then cut it off str
                    newStr += str.substring(0, str.indexOf("[[if %%"));
                    str = str.substring(str.indexOf("[[if %%"));
                    ifStr = str.substring(0, str.indexOf("[[endif]]") + 9);
                    str = str.substring(str.indexOf("[[endif]]") + 9);
                    // Parse if statement
                    if (ifStr.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[else\]\](.*)\[\[endif\]\]/)) {
                        // String has an [[else]]
                        ifMatch = ifStr.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[else\]\](.*)\[\[endif\]\]/);
                        if (ifMatch[2] == "matches") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]].match(new RegExp(ifMatch[3]))) {
                                newStr += ifMatch[4];
                            } else {
                                newStr += ifMatch[5];
                            }
                        } else if (ifMatch[2] == "imatches") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]].match(new RegExp(ifMatch[3], "i"))) {
                                newStr += ifMatch[4];
                            } else {
                                newStr += ifMatch[5];
                            }
                        } else if (ifMatch[2] == "isnot") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]] != ifMatch[3]) {
                                newStr += ifMatch[4];
                            } else {
                                newStr += ifMatch[5];
                            }
                        } else {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]] == ifMatch[3]) {
                                newStr += ifMatch[4];
                            } else {
                                newStr += ifMatch[5];
                            }
                        }
                    } else {
                        // String doesn't have an [[else]]
                        ifMatch = ifStr.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[endif\]\]/);
                        if (ifMatch[2] == "matches") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]].match(new RegExp(ifMatch[3]))) {
                                newStr += ifMatch[4];
                            }
                        } else if (ifMatch[2] == "imatches") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]].match(new RegExp(ifMatch[3], "i"))) {
                                newStr += ifMatch[4];
                            }
                        } else if (ifMatch[2] == "isnot") {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]] != ifMatch[3]) {
                                newStr += ifMatch[4];
                            }
                        } else {
                            if (vars[ifMatch[1]] && vars[ifMatch[1]] == ifMatch[3]) {
                                newStr += ifMatch[4];
                            }
                        }
                    }
                } else {
                    // Add whatever is left to newStr
                    newStr += str;
                    isRunning = false;
                }
            } while (isRunning);
            str = newStr;
        }
        
        // Parse vars
        for (var v in vars) {
            if (vars.hasOwnProperty(v)) {
                while (str.indexOf("%%" + v) != -1) {
                    str = str.replace("%%" + v, vars[v]);
                }
            }
        }
        
        // Return parsed string
        return str;
    },
    
    /**
     * Return an nsIURL object from a window.location object, a nsIURI instance,
     * or a string (and optionally a base to base it off of, if path is a string).
     */
    makeURL: function (path, base) {
        if (path.href) path = path.href;
        if (typeof path == "string") {
            if (base && base.href) base = base.href;
            if (typeof base == "string" && base.length > 0) {
                base = Services.io.newURI(base, null, null);
            }
            if (!(base && base instanceof Ci.nsIURI)) base = null;
            
            return Services.io.newURI(path, null, base).QueryInterface(Ci.nsIURL);
        } else if (path instanceof Ci.nsIURI) {
            return path.QueryInterface(Ci.nsIURL);
        } else {
            return path;
        }
    },
    
    /**
     * Prettier version of makeURL above (returns easier-named stuff including
     * parsed query string).
     */
    getURLParts: function (location, base) {
        let url = this.makeURL(location, base);
        
        let query = {};
        url.query.split("&").forEach(function (value) {
            if (value.indexOf("=") != -1) {
                query[decodeURIComponent(value.substring(0, value.indexOf("=")))] = decodeURIComponent(value.substring(value.indexOf("=") + 1));
            } else {
                query[decodeURIComponent(value)] = "";
            }
        });
        
        return {
            href: url.spec,
            protocol: url.scheme,
            host: url.host,
            path: url.filePath,
            query: query,
            hash: url.ref
        };
    },
    
    /**
     * Get a new XMLHttpRequest.
     */
    getXMLHttpRequest: function () {
        return new Services.appShell.hiddenDOMWindow.XMLHttpRequest();
    },
    
    /**
     * Get the name of the browser we're in.
     */
    getBrand: function () {
        return this.getString("chrome://branding/locale/brand.properties", "brandShortName", null, true);
    },
    
    /**
     * Get the MP4 Downloader version we have.
     *
     * @param {boolean} [stripSuffix] - Whether to leave just the version
     *        number, with no other suffix.
     *
     * @return {Promise.<string>} The MP4 Downloader version.
     */
    getVersion: function (stripSuffix) {
        return new Promise(function (resolve, reject) {
            try {
                Cu.import("resource://gre/modules/AddonManager.jsm");
                AddonManager.getAddonByID("mp4downloader@jeff.net", function (addon) {
                    let version = addon.version;
                    if (stripSuffix) {
                        version = version.match(/^([0-9.]+)(.*)$/)[1] || version;
                    }
                    resolve(version);
                });
            } catch (err) {
                reject(err);
            }
        });
    }
};
