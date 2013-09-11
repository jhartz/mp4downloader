/*
    Copyright (C) 2013  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var EXPORTED_SYMBOLS = ["util"];

var bundles = {};

try {
    Components.utils.import("resource://gre/modules/Services.jsm");
} catch (err) {
    // Import our Services.jsm shim
    Components.utils.import("resource://mp4downloader/Services-shim.jsm");
}

var util = {
    prefs: Services.prefs.getBranch("extensions.mp4downloader."),
    
    // Log an error or message
    log: function (msg) {
        if (!msg) return;
        Services.console.logStringMessage("MP4 Downloader:\n" + msg);
    },
    
    // Show an error or message
    alert: function (msg) {
        if (!msg) return;
        Services.prompt.alert(null, "MP4 Downloader", msg);
    },
    
    // Show a yes/no dilog
    confirm: function (msg) {
        if (!msg) return;
        return Services.prompt.confirmEx(null, "MP4 Downloader", msg, Services.prompt.STD_YES_NO_BUTTONS, null, null, null, null, {}) == 0;
    },
    
    // Show and optionally report an error message
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
    
    // Get a string from a string bundle, optionally from a formatted string
    getString: function (bundlename, name, formats) {
        if (!bundles.hasOwnProperty(bundlename)) {
            bundles[bundlename] = Services.strings.createBundle("chrome://mp4downloader/locale/" + bundlename + ".properties")
        }
        var bundle = bundles[bundlename];
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
    
    // Get a specific portion of a string starting from a certain string and (optionally) ending at a certain string
    getFromString: function (theString, beginStr, endStr) {
        if (typeof theString == "string" && beginStr && theString.indexOf(beginStr) != -1) {
            var fixedString = theString.substring(theString.indexOf(beginStr) + beginStr.length);
            if (endStr && fixedString.indexOf(endStr) != -1) {
                fixedString = fixedString.substring(0, fixedString.indexOf(endStr));
            }
            return fixedString;
        } else {
            // TODO: should we return null? Empty string? something else?
            return false;
        }
    },
    
    // Fast function to trim a string
    trimString: function (str) {
        if (str === null || str === undefined) return;
        if (typeof str.trim == "function") {
            // Added in Firefox 3.5
            return str.trim();
        } else {
            str = str.replace(/^\s+/, "");
            for (var i = str.length - 1; i >= 0; i -= 1) {
                if (/\S/.test(str.charAt(i))) {
                    str = str.substring(0, i + 1);
                    break;
                }
            }
            return str;
        }
    },
    
    // Because of all the JSON confusion happening in Firefox lately...
    parseJSON: function (str) {
        if (str.length > 0) {
            // Native JSON is not available until Firefox 3.5 (but nsIJSON might be deprecated, so we should use native JSON when we can)
            if (typeof JSON != "undefined") {
                return JSON.parse(str);
            } else {
                return Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON).decode(str);
            }
        }
    },
    
    // Replaces vars and parses if statements in a specially-formatted string
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
    
    // Return an nsIURL object from a window.location object, a nsIURI instance, or a string
    // (and optionally a base to base it off of, if path is a string)
    makeURL: function (path, base) {
        if (path.href) path = path.href;
        if (typeof path == "string") {
            if (base && base.href) base = base.href;
            if (typeof base == "string" && base.length > 0) {
                base = Services.io.newURI(base, null, null);
            }
            if (!(base && base instanceof Components.interfaces.nsIURI)) base = null;
            
            return Services.io.newURI(path, null, base).QueryInterface(Components.interfaces.nsIURL);
        } else if (path instanceof Components.interfaces.nsIURI) {
            return path.QueryInterface(Components.interfaces.nsIURL);
        } else {
            return path;
        }
    },
    
    // Prettier version of makeURL above (returns easier-named stuff including parsed query string)
    getURLParts: function (location, base) {
        var url = this.makeURL(location, base);
        
        var query = {};
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
    
    // Get a new XMLHttpRequest
    getXMLHttpRequest: function () {
        return new Services.appShell.hiddenDOMWindow.XMLHttpRequest();
    },
    
    // Get the name of the current product
    getBrand: function () {
        if (typeof this.brandstrings == "undefined") {
            this.brandstrings = Services.strings.createBundle("chrome://branding/locale/brand.properties");
        }
        return this.brandstrings.GetStringFromName("brandShortName");
    },
    
    // Get the MP4 Downloader version we have, then call `callback`
    getVersion: function (callback) {
        // (separate sections because of FF4's new asynchronous AddonManager)
        if (Components.classes["@mozilla.org/extensions/manager;1"] && Components.interfaces.nsIExtensionManager) {
            try {
                callback(Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("mp4downloader@jeff.net").version);
            } catch (err) {
                this.log("Cannot get current add-on version through nsIExtensionManager!");
            }
        } else {
            try {
                Components.utils.import("resource://gre/modules/AddonManager.jsm");
                AddonManager.getAddonByID("mp4downloader@jeff.net", function (addon) {
                    callback(addon.version);
                });
            } catch (err) {
                this.log("Cannot get current add-on version through AddonManager JSM!");
            }
        }
    }
};