/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 *
 * mpContentHandler: Functionality related to examining content windows and
 * downloading files
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["mpContentHandler"];

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");

var mpContentHandler = {
    downloadFromWindow: function(){},
    loadContentWindow: loadContentWindow
};

function loadContentWindow(contentWindow, retryTimeout) {
    let isValidPage = contentWindow &&
                      contentWindow.location &&
                      contentWindow.location.href.indexOf("://") != -1 &&
                      contentWindow.document &&
                      typeof contentWindow.document.getElementById == "function";
    if (!isValidPage) return;
    
    var host = contentWindow.location.hostname;
    var path = contentWindow.location.pathname;
    
    // Modify history.pushState so we can detect when history is modified but new page is not loaded
    // (will enable for all sites in future; currently limited to Facebook until further testing is complete)
    // TODO: Test this!!! Does it work on Facebook? Other sites?
    // (NOTE: This doesn't seem to work. Disabling until we find time to work on it.)
    /*
    if (host.substring(host.length - 12) == "facebook.com") {
        try {
            if (contentWindow.document.body.className.indexOf("mp4downloader_changeListenerAdded") == -1 && contentWindow.history && contentWindow.history.pushState) {
                var oldPushState = contentWindow.history.pushState;
                contentWindow.history.pushState = function () {
                    oldPushState.apply(this, arguments);
                    setTimeout(function () {
                        loadContentWindow(contentWindow, 500);
                    }, 500);
                };
                
                contentWindow.addEventListener("popstate", function () {
                    setTimeout(function () {
                        loadContentWindow(contentWindow, 500);
                    }, 500);
                }, false);
                
                contentWindow.document.body.className = "mp4downloader_changeListenerAdded " + contentWindow.document.body.className;
            }
        } catch (err) {}
    }
    */
    
    // Search for embedded videos
    if (mpUtils.prefs.getBoolPref("embedBtn")) {
        // Do not search through if we are inside an iframe embed (this is handled by parent page)
        if (!(contentWindow.top && contentWindow.self && contentWindow.top != contentWindow.self) ||
            (((host.substring(host.length - 11) != "youtube.com" && host.substring(host.length - 20) != "youtube-nocookie.com") || path.substring(0, 7) != "/embed/") &&
            (host.substring(host.length - 15) != "dailymotion.com" || path.substring(0, 7) != "/embed/") &&
            (host.substring(host.length - 16) != "player.vimeo.com" || path.substring(0, 7) != "/video/"))) {
            // Safe to go through
            ////////////////////////////////////////////////////////
            // TODO..............
            //mp4downloader.getEmbeddedVideos(contentWindow);
        }
    }
    
    // Place button inside video page
    if (mpUtils.prefs.getBoolPref("embedBtnOnVideo")) {
        //////////////////////////////////////////////////////////////////
        // TODO.....................
        /*
        if (mp4downloader.embedBtnOnVideo(contentWindow) == "retry") {
            // Retry (FB probably isn't loaded correctly yet)
            if (retryTimeout && retryTimeout < 10000) {
                setTimeout(function () {
                    loadContentWindow(contentWindow, retryTimeout + (retryTimeout / 2));
                }, retryTimeout);
            }
        }
        */
    }
}

/**
 * Save a video. The first parameter is the chrome browser window from whence
 * we came; the second is an object with parameters. See:
 * https://github.com/jhartz/mp4downloader/wiki/Video-Site-Module#params-for-savevideo
 */
function saveVideo(win, {
        url: targetURL,
        referrer: referrer,
        title: videoTitle,
        author: videoAuthor,
        site: videoSite,
        quality: isHQ
}) {
    videoTitle = "" + (videoTitle || mpUtils.getString("mp4downloader", "video"));

    let saveMode = mpUtils.prefs.getIntPref("saveMode") || 0;
    let useDTA = false;
    if (saveMode == 3) {
        if (win.DTA_AddingFunctions || win.DTA) {
            useDTA = true;
        } else {
            saveMode = 0;
        }
    }
    
    // Used for videoTitle and other stuff below
    let now = new Date();
    let replaces = {
        TITLE: videoTitle,
        HQ: (isHQ ? 1 : 0),
        AUTHOR: videoAuthor || "",
        SITE: videoSite,
        DOWNURL: targetURL,
        PAGEURL: referrer,
        DTA: useDTA ? 1 : 0,
        
        // Date/Time stuff
        YEAR: now.getFullYear(),
        SHORTYEAR: now.getFullYear().toString().substring(2),
        MONTH: now.getMonth() + 1,
        FULLMONTH: mpUtils.getString("mp4downloader", "month" + (now.getMonth() + 1)),
        SHORTMONTH: mpUtils.getString("mp4downloader", "shortmonth" + (now.getMonth() + 1)),
        DAY: now.getDate(),
        HOUR: now.getHours() == 0 ? 12 : now.getHours() > 12 ? now.getHours() - 12 : now.getHours(),
        FULLHOUR: now.getHours(),
        MINUTE: now.getMinutes().toString().length == 1 ? "0" + now.getMinutes().toString() : now.getMinutes(),
        SECOND: now.getSeconds().toString().length == 1 ? "0" + now.getSeconds().toString() : now.getSeconds()
    };
    
    if (mpUtils.prefs.getCharPref("defaultFilename")) {
        videoTitle = mpUtils.parseString(mpUtils.prefs.getCharPref("defaultFilename"), replaces);
    }
    
    // Normalize filename
    let illegalChars;
    if (Services.appinfo.OS == "WINNT") {
        illegalChars = /[<>:"/\\|?*\x00-\x1f]+/g;
    } else if (Services.appinfo.OS == "Darwin") {
        illegalChars = /[/\\\x00:]+/g;
    } else {
        illegalChars = /[/\\\x00]+/g;
    }
    videoTitle = videoTitle.replace(illegalChars, mpUtils.prefs.getCharPref("illegalCharReplacement"));
    
    if (useDTA) {
        let item = {
            url: targetURL,
            referrer: referrer,
            description: videoTitle,
            // DTA will try to set the mask to something else later on; we need to override this
            get mask () {
                return "*text*.mp4";
            },
            set mask (a) {
                return;
            }
        };
        if (mpUtils.prefs.getBoolPref("dtaOneClick")) {
            if (win.DTA && (win.DTA.turboSendToDown || win.DTA.turboSendLinksToManager)) {
                mpUtils.log("Using DTA 2.0 OneClick functions");
                (win.DTA.turboSendToDown || win.DTA.turboSendLinksToManager)(win, [item]);
            } else {
                mpUtils.log("Using legacy DTA OneClick functions");
                win.DTA_AddingFunctions.turboSendToDown([item]);
            }
        } else {
            if (win.DTA && mpUtils.prefs.getBoolPref("dtaAutoMask") && win.DTA.saveSingleItem) {
                // This sets the mask to *text*.mp4 for any future dTa dowloads until the user changes it back, which is why this isn't the default
                mpUtils.log("Using DTA 2.0 functions with mask");
                win.DTA.saveSingleItem(win, false, item);
            } else if (win.DTA && win.DTA.saveSingleLink) {
                mpUtils.log("Using DTA 2.0 functions");
                win.DTA.saveSingleLink(win, false, targetURL, referrer, videoTitle);
            } else {
                mpUtils.log("Using legacy DTA functions");
                win.DTA_AddingFunctions.saveSingleLink(false, targetURL, referrer, videoTitle);
            }
        }
    } else if (saveMode == 1 || saveMode == 2) {
        let dir;
        if (saveMode == 2) {
            let download_prefs = Services.prefs.getBranch("browser.download.");
            if (!download_prefs.getBoolPref("useDownloadDir")) {
                // Pref is set to "Always Ask"
                return promptAndSave(win, targetURL, videoTitle, referrer);
            } else {
                let folderList = download_prefs.getIntPref("folderList");
                if (folderList === 0) {
                    // Desktop
                    dir = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("Desk", Ci.nsIFile);
                } else if (folderList == 1) {
                    // Downloads
                    let dlMan = Cc["@mozilla.org/download-manager;1"].getService(Ci.nsIDownloadManager);
                    if (dlMan.defaultDownloadsDirectory) {
                        dir = dlMan.defaultDownloadsDirectory;
                    } else {
                        try {
                            dir = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("DfltDwnld", Ci.nsIFile);
                        } catch (err) {}
                    }
                } else {
                    dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
                    dir.initWithPath(download_prefs.getCharPref("dir"));
                }
                
                if (!dir || !dir.exists()) {
                    mpUtils.alert(mpUtils.getString("mp4downloader", "error_noDownloadsDir", [mpUtils.getBrand()]));
                    return promptAndSave(win, targetURL, videoTitle, referrer);
                }
            }
        }
        
        if (saveMode == 1) {
            let prefix = mpUtils.prefs.getCharPref("saveLocation");
            if (prefix.length > 0) {
                prefix = mpUtils.parseString(prefix, replaces);
                try {
                    dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
                    dir.initWithPath(prefix);
                } catch (err) {
                    mpUtils.alert(mpUtils.getString("mp4downloader", "error_invalidSaveLocation", [prefix]));
                    // Fall back to the "Save File" dialog
                    return promptAndSave(win, targetURL, videoTitle, referrer);
                }
                if (dir) {
                    try {
                        if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
                        var aNum = 0;
                        while (!dir.isDirectory()) {
                            aNum++;
                            dir.initWithPath(prefix + " (" + aNum + ")");
                            if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
                        }
                    } catch (err) {
                        mpUtils.alert(mpUtils.getString("mp4downloader", "error_uncreatedSaveLocation", [prefix]));
                        // Fall back to the "Save File" dialog
                        return promptAndSave(win, targetURL, videoTitle, referrer);
                    }
                } else {
                    // Fall back to the "Save File" dialog
                    return promptAndSave(win, targetURL, videoTitle, referrer);
                }
            } else {
                mpUtils.alert(mpUtils.getString("mp4downloader", "error_noSaveLocation"));
                // Fall back to the "Save File" dialog
                return promptAndSave(win, targetURL, videoTitle, referrer);
            }
        }
        
        if (mpUtils.prefs.getBoolPref("savePrompt") && !mpUtils.confirm(mpUtils.getString("mp4downloader", "prompt_useSaveDir", [videoTitle, dir.path]))) {
            return promptAndSave(win, targetURL, videoTitle, referrer);
        }
        
        var ext = ".mp4";
        if (videoTitle.substring(videoTitle.length - 4) == ".mp4" || videoTitle.substring(videoTitle.length - 4) == ".m4v") {
            ext = videoTitle.substring(videoTitle.length - 4);
            videoTitle = videoTitle.substring(0, videoTitle.length - 4);
        }
        
        // Make sure we're not overwriting anything
        try {
            let curNum = 0;
            let testfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            testfile.initWithFile(dir);
            testfile.append(videoTitle + ext);
            while (testfile.exists()) {
                curNum++;
                testfile.initWithFile(dir);
                testfile.append(videoTitle + " (" + curNum + ")" + ext);
            }
            if (curNum > 0) ext = " (" + curNum + ")" + ext;
        } catch (err) {}
        
        try {
            dir.append(videoTitle + ext);
        } catch (err) {
            mpUtils.error(mpUtils.getString("mp4downloader", "error_generic", ["saveVideo", err.toString()]));
            dir.append(mpUtils.getString("mp4downloader", "video") + ".mp4");
        }
        
        let io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let uri = io.newURI(targetURL, null, null);
        let target = io.newFileURI(dir);
        
        let isPrivate = null,
            privacyContext = null;
        try {
            // If all this fails, we'll know it's an older version and we should use the older versions of transfer.init and persist.saveURI
            if (typeof PrivateBrowsingUtils == "undefined") Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
            isPrivate = PrivateBrowsingUtils.isWindowPrivate(win);
            privacyContext = win.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIWebNavigation)
                                .QueryInterface(Ci.nsILoadContext);
        } catch (err) {
            mpUtils.log("Not using Private Browsing params...\n" + err);
        }
        
        let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
        let transfer = Cc["@mozilla.org/transfer;1"].createInstance(Ci.nsITransfer);
        if (isPrivate === null) {
            transfer.init(uri, target, "", null, null, null, persist);
        } else {
            transfer.init(uri, target, "", null, null, null, persist, isPrivate);
        }
        
        persist.progressListener = transfer;
        if (privacyContext === null) {
            persist.saveURI(uri, null, null, null, null, dir);
        } else {
            persist.saveURI(uri, null, null, null, null, dir, privacyContext);
        }
        
        // Eventually, for iTunes import and stuff, we will need to detect when it's done downloading
        // This page provides details on this: https://developer.mozilla.org/en/Code_snippets/Downloading_Files
    } else {
        return promptAndSave(win, targetURL, videoTitle, referrer);
    }
}

/**
 * Prompt the user for a save location, and save a video.
 * (See saveVideo)
 */
function promptAndSave(win, targetURL, videoTitle, referrer) {
    let oldIFI = win.initFileInfo;
    try {
        win.initFileInfo = function (aFI, aURL, aDocument, aContentType, aContentDisposition) {
        //win.initFileInfo = function (aFI, aURL, aURLCharset, aDocument, aContentType, aContentDisposition) {
            aFI.uri = win.makeURI(targetURL);
            aFI.fileName = videoTitle;
            aFI.fileExt = "mp4";
            aFI.fileBaseName = videoTitle;
        };
        win.saveURL(targetURL, "", "", false, false, win.makeURI(referrer), document);
        return true;
    } catch (err) {
        mpUtils.error(mpUtils.getString("mp4downloader", "error_generic", ["promptAndSave", err.toString()]));
        return false;
    } finally {
        // Set this back to what it was (just in case)
        win.initFileInfo = oldIFI;
    }
}
