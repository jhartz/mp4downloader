/*
    Copyright (C) 2014  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var EXPORTED_SYMBOLS = ["firstrun"];

var mp4downloader = {};
Components.utils.import("resource://mp4downloader/util.jsm", mp4downloader);

var firstrun = {
    migratePrefs: function () {
        // Migrate DTA pref from versions prior to 1.3.3
        try {
            if (mp4downloader.util.prefs.getBoolPref("dta")) {
                mp4downloader.util.prefs.setIntPref("saveMode", 3);
                mp4downloader.util.prefs.clearUserPref("dta");
            }
        } catch (err) {}
    },
    
    migrateOldPrefs: function () {
        // Migrate DTA prefs from version 1.2.x
        // NOTE: Firefox will throw an error if a pref is not found
        try {
            var oldPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("mp4downloader.");
            
            if (typeof oldPrefs.getBoolPref("dta") == "boolean" && oldPrefs.getBoolPref("dta") == true) {
                mp4downloader.util.prefs.setIntPref("saveMode", 3);
            }
            if (typeof oldPrefs.getBoolPref("dtaOC") == "boolean") {
                mp4downloader.util.prefs.setBoolPref("dtaOneClick", oldPrefs.getBoolPref("dtaOC"));
            }
            
            // Delete old pref branch
            oldPrefs.deleteBranch("");
        } catch (err) {}
    },
    
    addToolbarButton: function (document) {
        if (!document.getElementById("nav-bar")) {
            mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_notoolbar"));
            return false;
        }
        
        var navBar = document.getElementById("nav-bar");
        
        // In SeaMonkey, the button already exists (in BrowserToolbarPalette)
        if (document.getElementById("mp4downloader_button")) {
            // If it's parent isn't BrowserToolbarPalette, it's already on the toolbar
            if (document.getElementById("mp4downloader_button").parentNode.id != "BrowserToolbarPalette") return true;
            
            if (document.getElementById("throbber-box") && document.getElementById("throbber-box").parentNode.id != "BrowserToolbarPalette") {
                // Insert before SeaMonkey logo
                navBar.insertItem("mp4downloader_button", document.getElementById("throbber-box"));
            } else if (document.getElementById("print-button") && document.getElementById("print-button").parentNode.id != "BrowserToolbarPalette") {
                // Insert after the print button
                navBar.insertItem("mp4downloader_button", document.getElementById("print-button").nextSibling);
            } else {
                // Just stick at the end of the toolbar
                navBar.insertItem("mp4downloader_button");
            }
            navBar.setAttribute("currentset", navBar.currentSet);
            document.persist("nav-bar", "currentset");
            return true;
        }
        
        // If we're still here, we must be in Firefox
        if (navBar.currentSet.indexOf("downloads-button") != -1) {
            // Insert before the downloads button
            navBar.insertItem("mp4downloader_button", document.getElementById("downloads-button"));
        } else if (navBar.currentSet.indexOf("home-button") > navBar.currentSet.indexOf("urlbar-container")) {
            // If the home button is after the location bar (or if there is no location bar, but there is a home button), insert before home button
            navBar.insertItem("mp4downloader_button", document.getElementById("home-button"));
        } else if (navBar.currentSet.indexOf("home-button") != -1 && navBar.currentSet.indexOf("home-button") < navBar.currentSet.indexOf("urlbar-container")) {
            // If the home button is before the location bar, insert before the location bar
            navBar.insertItem("mp4downloader_button", document.getElementById("urlbar-container"));
        } else {
            // Just stick at the end of the toolbar
            navBar.insertItem("mp4downloader_button", null);
        }
        navBar.setAttribute("currentset", navBar.currentSet);
        document.persist("nav-bar", "currentset");
        return true;
    },
    
    openFirstrunPage: function (currentVersion, gBrowser, isFirstTime) {
        // Open firstrun or changelog page (if this is the first run or an updated version, respectively)
        // Change "1.3.3b1" to "1.3.3"
        var changelogVersion = currentVersion.match(/^([0-9.]+)(.*)$/)[1] || currentVersion;
        if (isFirstTime) {
            gBrowser.selectedTab = gBrowser.addTab("http://jhartz.github.io/mp4downloader/firefox/firstrun/en.html?browser=" + encodeURIComponent(mp4downloader.util.getBrand()) + "&version=" + encodeURIComponent(changelogVersion));
        } else {
            gBrowser.selectedTab = gBrowser.addTab("http://jhartz.github.io/mp4downloader/changelog/firefox/" + encodeURIComponent(changelogVersion) + ".en.html?browser=" + encodeURIComponent(mp4downloader.util.getBrand()));
        }
    }
};