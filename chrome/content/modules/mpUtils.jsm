/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 *
 * mpUtils: General utility functions for MP4 Downloader
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

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
     * Show an error or message to the user.
     */
    alert: function (msg) {
        if (!msg) return;
        Services.prompt.alert(null, "MP4 Downloader", msg);
    },
    
    /**
     * Show a yes/no dialog to the user.
     */
    confirm: function (msg) {
        if (!msg) return;
        return Services.prompt.confirmEx(null, "MP4 Downloader", msg, Services.prompt.STD_YES_NO_BUTTONS, null, null, null, null, {}) == 0;
    },
    
    /**
     * Create a site error object for later reporting. If extraData is
     * provided, then it is assumed that this is a bug that should be reported.
     * (used by Video Site Modules)
     *
     * @param {string} localizedMsg - The error message to show the user.
     * @param {Object} [extraData] - Any debugging data, if applicable. Must be
     *        JSON-encodable.
     *
     * @return {Error} An Error instance that also contains the provided data.
     */
    createSiteError: function (localizedMsg, extraData) {
        let err = new Error(localizedMsg);
        err.mp4downloaderSiteError = true;
        err.mp4downloaderExtraData = extraData;
        return err;
    },
    
    /**
     * Show an error message to the user and give them the option to report it.
     */
    error: function (msg, extradata) {
        this.alert(msg + "\n\n" + this.getString("mp4downloader", "reportmsg"));
        // NOTE: below is if someday we get an online automatic error reporting system in place
        /*
        let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
        if (!browserWindow) {
            mpUtils.alert(msg);
        } else {
            if (mpUtils.confirm(msg + "\n\n" + this.getString("mp4downloader", "reportmsg"))) {
                // Open new tab with contact page and attempt to pre-fill some data (including extradata)
                let t = browserWindow.gBrowser.addTab("http://mp4downloader.mozdev.org/drupal/contact");
                browserWindow.gBrowser.selectedTab = t;
                let tab = browserWindow.gBrowser.getBrowserForTab(t);
                let applied = false;
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
     *
     * @param {string} bundleName - Either the full path to a string bundle, or
     *        the basename of one of MP4 Downloader's string bundles (without
     *        the ".properties" in the latter case).
     * @param {string} name - The name of the property or string to get from
     *        the string bundle.
     * @param {Array} [formats] - Any parameters to apply when resolving the
     *        string.
     */
    getString: function (bundleName, name, formats) {
        if (bundleName.indexOf("/") == -1) {
            // It's just the name of one of our bundles
            bundleName = "chrome://mp4downloader/locale/" + bundleName + ".properties";
        }
        
        if (!bundles.hasOwnProperty(bundleName)) {
            // From MDN:
            // https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless#Step_10_Bypass_cache_when_loading_properties_files
            /* HACK: The string bundle cache is cleared on addon shutdown, however it doesn't appear to do so reliably.
               Errors can erratically happen on next load of the same file in certain instances. (at minimum, when strings are added/removed)
               The apparently accepted solution to reliably load new versions is to always create bundles with a unique URL so as to bypass the cache.
               This is accomplished by passing a random number in a parameter after a '?'. (this random ID is otherwise ignored)
               The loaded string bundle is still cached on startup and should still be cleared out of the cache on addon shutdown.
               This just bypasses the built-in cache for repeated loads of the same path so that a newly installed update loads cleanly. */
            bundles[bundleName] = Services.strings.createBundle(bundleName + "?" + Math.random());
        }
        
        let bundle = bundles[bundleName];
        try {
            if (formats) {
                return bundle.formatStringFromName(name, formats, formats.length);
            } else {
                return bundle.GetStringFromName(name);
            }
        } catch (err) {
            return "STRING ERROR " + JSON.stringify([bundleName, name, formats]);
        }
    },
    
    /**
     * Get a specific portion of a string, deliminated by a starting string and
     * an ending string (each of which is optional).
     *
     * @param {string} str - The string to find a substring of.
     * @param {string} [begin] - The string that marks the start of the portion
     *        of `str` that we want (not included in the result).
     * @param {string} [end] - The string that marks the end of the portion
     *        of `str` that we want (not included in the result).
     */
    getFromString: function (str, begin, end) {
        str = "" + str;
        
        if (begin) {
            let index = str.indexOf(begin);
            if (index != -1) str = str.substring(index + begin.length);
        }
        
        if (end) {
            let index = str.indexOf(end);
            if (index != -1) str = str.substring(0, index);
        }
        
        return str;
    },
    
    /**
     * Replaces vars and parses if statements in a specially-formatted string.
     */
    parseString: function (str, vars) {
        // Syntax explanation: http://jhartz.github.io/mp4downloader/docs/selective-content-replacement.html
        if (!str) str = "";
        if (!vars) vars = {};
        
        // Make sure vars are strings
        for (let v in vars) {
            if (vars.hasOwnProperty(v)) {
                if (typeof vars[v] != "string") {
                    vars[v] = vars[v].toString();
                }
            }
        }
        
        // Parse "if" statements
        // (not needed if we have no vars, so test if the vars serialize to {})
        if (JSON.stringify(vars) != "{}" && str.match(/\[\[if %%([A-Z]+) (is|isnot|i?matches) (.+)\]\](.*)\[\[endif\]\]/)) {
            let isRunning = true, newStr = "", ifStr = "", ifMatch;
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
        for (let v in vars) {
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
     * Return an nsIURL object from a window.location object, an nsIURI object,
     * or a string.
     *
     * @param {Location|nsIURI|string} path - The original path.
     * @param {Location|nsIURI|string} [base] - A base path that the original
     *        path is relative to.
     *
     * @return {nsIURL} An nsIURL object representing the path.
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
     * Prettier version of makeURL above (returns components of the URL in an
     * easy-to-access way).
     *
     * @param {Location|nsIURI|string} path - The original path.
     * @param {Location|nsIURI|string} [base] - A base path that the original
     *        path is relative to.
     *
     * @return {Object} Parts of the URL, including "href", "protocol",
     *         "host" (full domain name), "tld" (top-level domain),
     *         "domain" (top-level and second-level domain),
     *         "path", "query", and "hash".
     */
    getURLParts: function (path, base) {
        let url = this.makeURL(path, base);
        
        let tldDelim = url.host.lastIndexOf(".");
        let tld = url.host.substring(tldDelim + 1);
        
        let domain = url.host.substring(0, tldDelim);
        domain = domain.substring(domain.lastIndexOf(".") + 1) + "." + tld;
        
        return {
            href: url.spec,
            protocol: url.scheme,
            
            // full domain name
            host: url.host,
            // top-level domain
            tld: tld,
            // top-level and second-level domain
            domain: domain,
            
            path: url.filePath,
            query: mpUtils.parseQuery(url.query),
            hash: url.ref
        };
    },
    
    /**
     * Parse a URL-encoded query string.
     *
     * @param {string} queryString - The URL-encoded query string.
     *
     * @return {Object} The parsed data, organized into key-value pairs.
     */
    parseQuery: function (queryString) {
        let query = {};
        queryString.split("&").forEach(function (entry) {
            let key, value = "";
            let index = entry.indexOf("=");
            if (index != -1) {
                key = entry.substring(0, index);
                value = entry.substring(index + 1).replace(/\+/g, " ");
            } else {
                key = entry;
            }
            query[decodeURIComponent(key)] = decodeURIComponent(value);
        });
        return query;
    },
    
    /**
     * Get a reference to a new XMLHttpRequest.
     */
    getXMLHttpRequest: function () {
        return new Services.appShell.hiddenDOMWindow.XMLHttpRequest();
    },
    
    /**
     * Make an HTTP request.
     *
     * @param {string} method - The HTTP method to use.
     * @param {string} url - The URL to go to.
     * @param {Object} [headers] - Any request headers to set.
     * @param {*} [data] - Any data to send with the request.
     *
     * @return {Promise.<string>} The response from the server. If the request
     *         fails, the Promise is rejected, with the reason being the
     *         XMLHttpRequest instance.
     */
    request: function (method, url, headers, data) {
        return new Promise(function (resolve, reject) {
            var req = mpUtils.getXMLHttpRequest();
            req.open(method, url, true);
            req.onreadystatechange = function () {
                if (req.readyState == 4) {
                    if (req.status == 200 && req.responseText) {
                        resolve(req.responseText);
                    } else {
                        reject(req);
                    }
                }
            };
            if (headers) {
                Object.keys(headers).forEach(function (header) {
                    req.setRequestHeader(header, headers[header]);
                });
            }
            req.send(data || null);
        });

    },
    
    /**
     * Get the name of the browser we're in.
     */
    getBrand: function () {
        return this.getString("chrome://branding/locale/brand.properties", "brandShortName");
    },
    
    /**
     * Get which MP4 Downloader version we have.
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
