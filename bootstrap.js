/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");


const SITE_ROOT = "https://jhartz.github.io/mp4downloader/";

function getFirstrunURL() {
    return mpUtils.getVersion(true).then(function (version) {
        return SITE_ROOT + "firefox/firstrun/en.html?" +
            "browser=" + encodeURIComponent(mpUtils.getBrand()) + "&" +
            "version=" + encodeURIComponent(version);
    });
}

function getChangelogURL() {
    return mpUtils.getVersion(true).then(function (version) {
        return SITE_ROOT + "changelog/firefox/" + encodeURIComponent(version) + ".en.html?" +
            "browser=" + encodeURIComponent(mpUtils.getBrand());
    });
}


const DEFAULT_PREFS = {
    // Is the "Download" button placed below supported videos embedded inside web pages?
    embedBtn: true,
    
    // Is the "Download" button placed inside the actual video page enabled?
    embedBtnOnVideo: true,
    
    // Is the context menu button enabled?
    contextmenu: true,
    
    // Is the context menu button enabled on links to videos?
    linkcontextmenu: true,
    
    // Should we use DownThemAll OneClick to download videos (if using dTa)?
    dtaOneClick: false,
    
    // Should we automatically set the DownThemAll mask to *text*.mp4 (if using dTa)?
    // (disabled by default since dTa then sets it as the mask for all future downloads until changed)
    dtaAutoMask: false,
    
    // Should we download high-quality videos when possible (YouTube, Dailymotion, and Vimeo only)?
    hq: false,
    
    // Format of the default file name (uses selective content replacement)
    defaultFilename: "%%TITLE",
    
    // How to save videos (0 = always ask, 1 = specific dir, 2 = FF downloads directory, 3 = DTA)
    saveMode: 0,
    
    // Directory to save videos in when saveMode is 1 (uses selective content replacement)
    saveLocation: "",
    
    // Should we prompt before automtically saving (when saveMode is 1, 2, or 3)?
    savePrompt: false,

    // Character used to replace illegal characters in file names
    illegalCharReplacement: "-"
};

// For prefs that use selective content replacement, information on the syntax can be found at:
// http://jhartz.github.io/mp4downloader/docs/selective-content-replacement.html


const STYLESHEETS = ["chrome://mp4downloader/skin/overlay.css"];


/* BOOTSTRAP CODE */

function install(data, reason) {}
function uninstall(data, reason) {}

function startup(data, reason) {
    // Import modules
    Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");
    Cu.import("chrome://mp4downloader/content/modules/mpWindowHandler.jsm");
    
    // Set default prefs (NOTE: not user prefs)
    Object.keys(DEFAULT_PREFS).forEach(function (name) {
        mpUtils.prefs.setDefaultPref(name, DEFAULT_PREFS[name]);
    });
    
    // Load browser stylesheets
    let sheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    for (let sheet of STYLESHEETS) {
        let sheetURI = Services.io.newURI(sheet, null, null);
        sheetService.loadAndRegisterSheet(sheetURI, sheetService.AUTHOR_SHEET);
    }
    
    // Load into all existing browser windows
    let enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
        mpWindowHandler.loadWindow(enumerator.getNext(), reason == ADDON_INSTALL);
    }
    
    // Listen for new windows
    Services.ww.registerNotification(windowWatcher);
    
    // Open first run or changelog pages, if necessary
    let urlPromise;
    if (reason == ADDON_INSTALL) urlPromise = getFirstrunURL();
    if (reason == ADDON_UPGRADE) urlPromise = getChangelogURL();
    if (urlPromise) {
        urlPromise.then(function (url) {
            let win = Services.wm.getMostRecentWindow("navigator:browser");
            if (win && win.gBrowser) {
                win.gBrowser.selectedTab = win.gBrowser.addTab(url);
            }
        });
    }
}

function shutdown(data, reason) {
    // Remove "new window" listener
    Services.ww.unregisterNotification(windowWatcher);
    
    // Unload from all existing browser windows
    let enumerator = Services.wm.getEnumerator("navigator:browser");
    let win;
    while (enumerator.hasMoreElements()) {
        if (win = enumerator.getNext()) {
            mpWindowHandler.unloadWindow(win, reason == ADDON_UPGRADE || reason == ADDON_DOWNGRADE);
        }
    }
    
    // Unload browser stylesheets
    let sheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    for (let sheet of STYLESHEETS) {
        let sheetURI = Services.io.newURI(sheet, null, null);
        if (sheetService.sheetRegistered(sheetURI, sheetService.AUTHOR_SHEET)) {
            sheetService.unregisterSheet(sheetURI, sheetService.AUTHOR_SHEET);
        }
    }
    
    // From MDN:
    // https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless#Step_9_bootstrap.js
    // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
    //               in order to fully update images and locales, their caches need clearing here
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);
    
    // Unload modules
    Cu.unload("chrome://mp4downloader/content/modules/mpUtils.jsm");
    Cu.unload("chrome://mp4downloader/content/modules/mpWindowHandler.jsm");
}

/* WINDOW LOADING/UNLOADING CODE */

var windowWatcher = function windowWatcher(win, topic) {
    if (topic != "domwindowopened") return;
    
    win.addEventListener("load", function onLoad() {
        win.removeEventListener("load", onLoad, false);
        if (win.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
            mpWindowHandler.loadWindow(win);
        }
    }, false);
}
