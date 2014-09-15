/*
    Copyright (C) 2014  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var mp4downloader = {};

var mp4downloader_preferences = {
    checkDTA: function () {
        // Check if DownThemAll is installed
        // (NOTE: This can ONLY be called once, preferably when the window is loading)
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
        var browserWindow = wm ? wm.getMostRecentWindow("navigator:browser") : null;
        if (browserWindow) {
            if (!browserWindow.DTA_AddingFunctions && !browserWindow.DTA) {
                // DTA is not installed, so disable the corresponding preferences
                document.getElementById("p_dta").disabled = true;
                document.getElementById("p_dtaOneClick").hidden = true;
                document.getElementById("p_dtaAutoMask").hidden = true;
                document.getElementById("noDTA").hidden = false;
            }
        }
    },
    
    checkOneClick: function () {
        // If OneClick is selected, hide AutoMask
        if (document.getElementById("p_dtaOneClick").checked == false) {
            document.getElementById("p_dtaAutoMask").style.visibility = "visible";
        } else {
            document.getElementById("p_dtaAutoMask").style.visibility = "hidden";
        }
    },
    
    checkSaveMode: function () {
        // If Custom is not selected, disable browse box and hide help info
        if (document.getElementById("p_saveMode").selectedItem == document.getElementById("saveModeCustom")) {
            document.getElementById("p_saveLocation").disabled = false;
            document.getElementById("saveModeBrowse").disabled = false;
            document.getElementById("saveModeHelp").style.visibility = "visible";
        } else {
            document.getElementById("p_saveLocation").disabled = true;
            document.getElementById("saveModeBrowse").disabled = true;
            document.getElementById("saveModeHelp").style.visibility = "hidden";
        }
        
        // If DTA is not selected, disable DTA-specific preferences
        if (document.getElementById("p_saveMode").selectedItem == document.getElementById("p_dta")) {
            document.getElementById("p_dtaOneClick").disabled = false;
            document.getElementById("p_dtaAutoMask").disabled = false;
        } else {
            document.getElementById("p_dtaOneClick").disabled = true;
            document.getElementById("p_dtaAutoMask").disabled = true;
        }
    },
    
    checkFilenameMenu: function () {
        if (document.getElementById("filenameMenu").selectedItem == document.getElementById("filenameMenuCustom")) {
            document.getElementById("p_defaultFilename").disabled = false;
            document.getElementById("filenameHelp").style.visibility = "visible";
        } else {
            document.getElementById("p_defaultFilename").value = document.getElementById("filenameMenu").selectedItem.getAttribute("data-value");
            document.getElementById("filenameHelp").style.visibility = "hidden";
            
            // Force elem to update pref value, then disable
            document.getElementById("p_defaultFilename").disabled = false;
            var dummyEvent = document.createEvent("Event");
            dummyEvent.initEvent("input", true, false);
            document.getElementById("p_defaultFilename").dispatchEvent(dummyEvent);
            document.getElementById("p_defaultFilename").disabled = true;
        }
    },
    
    openLink: function (link) {
        // NOTE: When called from an <html:a> tag, returning a truthy value will let the <html:a> tag open the link itself.
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
        if (wm && wm.getMostRecentWindow("navigator:browser")) {
            // Check each browser instance for the link
            var browserEnumerator = wm.getEnumerator("navigator:browser");
            var found = false;
            while (!found && browserEnumerator.hasMoreElements()) {
                // Check each tab in this browser instance
                var browserWin = browserEnumerator.getNext()
                var tabbrowser = browserWin.gBrowser;
                for (var i = 0; i < tabbrowser.browsers.length; i++) {
                    if (tabbrowser.getBrowserAtIndex(i).currentURI.spec == link) {
                        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[i];
                        browserWin.focus();
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                var browserWindow = wm.getMostRecentWindow("navigator:browser");
                browserWindow.gBrowser.selectedTab = browserWindow.gBrowser.addTab(link);
                try {
                    browserWindow.focus();
                } catch (e) {}
            }
        } else {
            window.open(link);
        }
    },
    
    chooseFolder: function () {
        var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
        fp.init(window, mp4downloader.util.getString("preferences", "choosefolder"), Components.interfaces.nsIFilePicker.modeGetFolder);
        fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
        
        // First try to open what's currently configured
        var oldFolder = document.getElementById("p_saveLocation").value;
        // Get rid of selective content replacement
        if (oldFolder.indexOf("%%") != -1) {
            oldFolder = oldFolder.substring(0, oldFolder.indexOf("%%"));
        }
        if (oldFolder.indexOf("[[if") != -1) {
            oldFolder = oldFolder.substring(0, oldFolder.indexOf("[[if"));
        }
        if (oldFolder) {
            try {
                var dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                dir.initWithPath(oldFolder);
                while (!dir.exists() && dir.parent) {
                    dir = dir.parent;
                }
                if (!dir.parent) {
                    oldFolder = null;
                } else {
                    fp.displayDirectory = dir;
                }
            } catch (err) {
                oldFolder = null;
            }
        }
        // Since we might change oldFolder in the above block, a simple "else" won't work
        if (!oldFolder) {
            // Try to find the user's downloads directory (FF3.5+)
            var dlMan = Components.classes["@mozilla.org/download-manager;1"].getService(Components.interfaces.nsIDownloadManager);
            if (dlMan.userDownloadsDirectory) {
                fp.displayDirectory = dlMan.userDownloadsDirectory;
            } else if (dlMan.defaultDownloadsDirectory) {
                fp.displayDirectory = dlMan.defaultDownloadsDirectory;
            } else {
                // We'll just use the desktop
                fp.displayDirectory = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Desk", Components.interfaces.nsIFile);
            }
        }
        
        // TODO: Use showAsync if available (https://bugzilla.mozilla.org/show_bug.cgi?id=731307)
        if (fp.show() == Components.interfaces.nsIFilePicker.returnOK) {
            document.getElementById("p_saveLocation").value = fp.file.path;
            var dummyEvent = document.createEvent("Event");
            dummyEvent.initEvent("input", true, false);
            document.getElementById("p_saveLocation").dispatchEvent(dummyEvent);
        }
    },
    
    // Set caption to "MP4 Downloader x.x.x" and make it a link to release notes
    // (called from onload code)
    updateLabel: function (currentVersion) {
        if (currentVersion) {
            document.getElementById("titleLabel").setAttribute("value", mp4downloader.util.getString("preferences", "nameversion", [currentVersion]));
            
            // Add link to changelog
            var changelogVersion = currentVersion.match(/^([0-9.]+)(.*)$/); // to change "1.3.3b1" to "1.3.3"
            if (changelogVersion[1]) changelogVersion = changelogVersion[1];
            document.getElementById("titleLabel").style.cursor = "pointer";
            document.getElementById("titleLabel").addEventListener("click", function () {
                mp4downloader_preferences.openLink("http://jhartz.github.io/mp4downloader/changelog/firefox/" + encodeURIComponent(changelogVersion) + ".en.html");
            }, false);
        }
    }
};

window.addEventListener("load", function () {
    Components.utils.import("resource://mp4downloader/util.jsm", mp4downloader);
    
    // Set title at top
    try {
        if (Components.classes["@mozilla.org/extensions/manager;1"] && Components.interfaces.nsIExtensionManager) {
            try {
                mp4downloader_preferences.updateLabel(Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("mp4downloader@jeff.net").version);
            } catch (err) {}
        } else {
            try {
                // use FF4's new AddonManager JSM
                Components.utils.import("resource://gre/modules/AddonManager.jsm");
                AddonManager.getAddonByID("mp4downloader@jeff.net", function (addon) {
                    mp4downloader_preferences.updateLabel(addon.version);
                });
            } catch (err) {}
        }
    } catch (err) {}
    
    // Check DTA, save mode, and OneClick prefs (in that order)
    mp4downloader_preferences.checkDTA();
    mp4downloader_preferences.checkSaveMode();
    mp4downloader_preferences.checkOneClick();
    
    // The rest is for default filename prefs
    var val = document.getElementById("p_defaultFilename").value;
    var radios = document.getElementById("filenameMenu").getElementsByTagName("menuitem");
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].getAttribute("data-value") && radios[i].getAttribute("data-value") == val) {
            document.getElementById("filenameMenu").selectedItem = radios[i];
            document.getElementById("p_defaultFilename").disabled = true;
            document.getElementById("filenameHelp").style.visibility = "hidden";
            return;
        }
    }
    
    // If we're still here, "Custom" must be selected
    document.getElementById("filenameMenu").selectedItem = document.getElementById("filenameMenuCustom");
    document.getElementById("p_defaultFilename").disabled = false;
    document.getElementById("filenameHelp").style.visibility = "visible";
}, false);