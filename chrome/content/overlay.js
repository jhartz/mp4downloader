/*
    Copyright (C) 2016  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

// A list of common variable names used here is available at:
// https://github.com/jhartz/mp4downloader/wiki/Code-Variables

var mp4downloader = {
    // Detect and downloads videos from supported sites (used by toolbar button, context menu, and more)
    mp4download: function (event, contentWindow) {
        // Make sure button was not right-clicked (if it was clicked)
        var wasClickedGood = (
            !event ||
            (event && !event.type) ||
            (
                event && event.type &&
                ((event.type != "click") || (event.type == "click" && event.which == 1))
            )
        );
        if (!wasClickedGood) return;
        
        // Make sure contentWindow is set
        if (!contentWindow) {
            contentWindow = window.content;
        }
        
        // Check to make sure we are on a "real" website (mostly just blocking out "about:" pages)
        var onRealSite = (
            contentWindow &&
            contentWindow.location &&
            contentWindow.location.toString().indexOf("://") != -1 &&
            contentWindow.document &&
            typeof contentWindow.document.getElementById == "function"
        );
        if (!onRealSite) {
            // Probably on about:blank (or something similar)
            this.util.alert(this.util.getString("mp4downloader", "error_novideo"));
            return;
        }
        
        var host = contentWindow.location.hostname;
        var path = contentWindow.location.pathname;
        var query = "&" + contentWindow.location.search.substring(1);
        var hash = contentWindow.location.hash;
        
        // TODO: We need to do some pre-planning, and know what quality we wanna
        // download, from which site, etc.
        var p = mpUtils.siteModulesByName["youtube"].downloadVideoByWindow(contentWindow, "el quality");
        /*
        mpUtils.siteModules.map(function (siteModule) {
            return siteModule.testWindow(contentWindow, function () {
                // DL button clicked
            });
        });
        */
        
        // Not recognized
        if (!p) {
            try {
                // TODO: Would we find embedButtonInitialized if it's inside a frame?
                // (Or would getEmbeddedVideos return true for a frame? - would it even find a frame?)
                // (maybe new param - searchInFrames or something)
                if (this.getEmbeddedVideos(contentWindow) || contentWindow.document.getElementsByClassName("mp4downloader_embedButtonInitialized").length > 0) {
                    this.util.alert(this.util.getString("mp4downloader", "error_novideo") + "\n\n" + this.util.getString("mp4downloader", "error_embed"));
                } else {
                    this.util.alert(this.util.getString("mp4downloader", "error_novideo"));
                }
            } catch (err) {
                this.util.alert(this.util.getString("mp4downloader", "error_novideo"));
            }
        }
    },
    
    
    /* SAVE FUNCTIONS */
    saveVideo: function (targetURL, refer, videoTitle, videoAuthor, videoSite, isHQ) {
        // TODO: Do we really still need this?
        if (targetURL.indexOf("&amp;") != -1) {
            this.util.log("Found &amp; in " + targetURL);
            targetURL = targetURL.replace(/&amp;/g, "&");
        }
        
        try {
            if (typeof videoTitle != "string") {
                videoTitle = videoTitle.toString();
            }
        } catch (err) {
            videoTitle = this.util.getString("mp4downloader", "video");
        }
        
        var saveMode = mpUtils.prefs.getIntPref("saveMode") || 0;
        var useDTA = false;
        if (saveMode == 3) {
            if (window.DTA_AddingFunctions || window.DTA) {
                useDTA = true;
            } else {
                saveMode = 0;
            }
        }
        
        // Used for videoTitle and other stuff below
        var now = new Date();
        var replaces = {
            TITLE: videoTitle,
            HQ: (isHQ ? 1 : 0),
            AUTHOR: videoAuthor || "",
            SITE: videoSite,
            DOWNURL: targetURL,
            PAGEURL: refer,
            DTA: useDTA ? 1 : 0,
            
            // Date/Time stuff
            YEAR: now.getFullYear(),
            SHORTYEAR: now.getFullYear().toString().substring(2),
            MONTH: now.getMonth() + 1,
            FULLMONTH: this.util.getString("mp4downloader", "month" + (now.getMonth() + 1)),
            SHORTMONTH: this.util.getString("mp4downloader", "shortmonth" + (now.getMonth() + 1)),
            DAY: now.getDate(),
            HOUR: now.getHours() == 0 ? 12 : now.getHours() > 12 ? now.getHours() - 12 : now.getHours(),
            FULLHOUR: now.getHours(),
            MINUTE: now.getMinutes().toString().length == 1 ? "0" + now.getMinutes().toString() : now.getMinutes(),
            SECOND: now.getSeconds().toString().length == 1 ? "0" + now.getSeconds().toString() : now.getSeconds()
        };
        
        if (mpUtils.prefs.getCharPref("defaultFilename")) {
            videoTitle = this.util.parseString(mpUtils.prefs.getCharPref("defaultFilename"), replaces);
        }
        
        // Normalize filename
        var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);
        if (xulRuntime.OS == "WINNT") {
            var illegalChars = /[<>:"/\\|?*\x00-\x1f]+/g;
        } else if (xulRuntime.OS == "Darwin") {
            var illegalChars = /[/\\\x00:]+/g;
        } else {
            var illegalChars = /[/\\\x00]+/g;
        }
        videoTitle = videoTitle.replace(illegalChars, mpUtils.prefs.getCharPref("illegalCharReplacement"));
        
        if (useDTA) {
            var item = {
                url: targetURL,
                referrer: refer,
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
                if (window.DTA && (window.DTA.turboSendToDown || window.DTA.turboSendLinksToManager)) {
                    this.util.log("Using DTA 2.0 OneClick functions");
                    (window.DTA.turboSendToDown || window.DTA.turboSendLinksToManager)(window, [item]);
                } else {
                    this.util.log("Using legacy DTA OneClick functions");
                    window.DTA_AddingFunctions.turboSendToDown([item]);
                }
            } else {
                if (window.DTA && mpUtils.prefs.getBoolPref("dtaAutoMask") && window.DTA.saveSingleItem) {
                    // This sets the mask to *text*.mp4 for any future dTa dowloads until the user changes it back, which is why this isn't the default
                    this.util.log("Using DTA 2.0 functions with mask");
                    window.DTA.saveSingleItem(window, false, item);
                } else if (window.DTA && window.DTA.saveSingleLink) {
                    this.util.log("Using DTA 2.0 functions");
                    window.DTA.saveSingleLink(window, false, targetURL, refer, videoTitle);
                } else {
                    this.util.log("Using legacy DTA functions");
                    window.DTA_AddingFunctions.saveSingleLink(false, targetURL, refer, videoTitle);
                }
            }
        } else if (saveMode == 1 || saveMode == 2) {
            var dir;
            if (saveMode == 2) {
                var download_prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("browser.download.");
                if (!download_prefs.getBoolPref("useDownloadDir")) {
                    // Pref is set to "Always Ask"
                    return this.promptAndSave(targetURL, videoTitle, refer);
                } else {
                    var folderList = download_prefs.getIntPref("folderList");
                    if (folderList === 0) {
                        // Desktop
                        dir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Desk", Components.interfaces.nsIFile);
                    } else if (folderList == 1) {
                        // Downloads
                        var dlMan = Components.classes["@mozilla.org/download-manager;1"].getService(Components.interfaces.nsIDownloadManager);
                        if (dlMan.defaultDownloadsDirectory) {
                            dir = dlMan.defaultDownloadsDirectory;
                        } else {
                            try {
                                dir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("DfltDwnld", Components.interfaces.nsIFile);
                            } catch (err) {}
                        }
                    } else {
                        dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                        dir.initWithPath(download_prefs.getCharPref("dir"));
                    }
                    
                    if (!dir || !dir.exists()) {
                        this.util.alert(this.util.getString("mp4downloader", "error_noDownloadsDir", [this.util.getBrand()]));
                        return this.promptAndSave(targetURL, videoTitle, refer);
                    }
                }
            }
            
            if (saveMode == 1) {
                var prefix = mpUtils.prefs.getCharPref("saveLocation");
                if (prefix.length > 0) {
                    prefix = this.util.parseString(prefix, replaces);
                    try {
                        dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                        dir.initWithPath(prefix);
                    } catch (err) {
                        this.util.alert(this.util.getString("mp4downloader", "error_invalidSaveLocation", [prefix]));
                        // Fall back to the "Save File" dialog
                        return this.promptAndSave(targetURL, videoTitle, refer);
                    }
                    if (dir) {
                        try {
                            if (!dir.exists()) dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
                            var aNum = 0;
                            while (!dir.isDirectory()) {
                                aNum++;
                                dir.initWithPath(prefix + " (" + aNum + ")");
                                if (!dir.exists()) dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
                            }
                        } catch (err) {
                            this.util.alert(this.util.getString("mp4downloader", "error_uncreatedSaveLocation", [prefix]));
                            // Fall back to the "Save File" dialog
                            return this.promptAndSave(targetURL, videoTitle, refer);
                        }
                    } else {
                        // Fall back to the "Save File" dialog
                        return this.promptAndSave(targetURL, videoTitle, refer);
                    }
                } else {
                    this.util.alert(this.util.getString("mp4downloader", "error_noSaveLocation"));
                    // Fall back to the "Save File" dialog
                    return this.promptAndSave(targetURL, videoTitle, refer);
                }
            }
            
            if (mpUtils.prefs.getBoolPref("savePrompt") && !mpUtils.confirm(this.util.getString("mp4downloader", "prompt_useSaveDir", [videoTitle, dir.path]))) {
                return this.promptAndSave(targetURL, videoTitle, refer);
            }
            
            var ext_butThisVariableLookedLonelySoImAppendingThisExtraText = ".mp4";
            if (videoTitle.substring(videoTitle.length - 4) == ".mp4" || videoTitle.substring(videoTitle.length - 4) == ".m4v") {
                ext_butThisVariableLookedLonelySoImAppendingThisExtraText = videoTitle.substring(videoTitle.length - 4);
                videoTitle = videoTitle.substring(0, videoTitle.length - 4);
            }
            
            // Make sure we're not overwriting anything
            try {
                var curNum = 0;
                var testfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                testfile.initWithFile(dir);
                testfile.append(videoTitle + ext_butThisVariableLookedLonelySoImAppendingThisExtraText);
                while (testfile.exists()) {
                    curNum++;
                    testfile.initWithFile(dir);
                    testfile.append(videoTitle + " (" + curNum + ")" + ext_butThisVariableLookedLonelySoImAppendingThisExtraText);
                }
                if (curNum > 0) ext_butThisVariableLookedLonelySoImAppendingThisExtraText = " (" + curNum + ")" + ext_butThisVariableLookedLonelySoImAppendingThisExtraText;
            } catch (err) {}
            
            try {
                dir.append(videoTitle + ext_butThisVariableLookedLonelySoImAppendingThisExtraText);
            } catch (err) {
                this.util.error(this.util.getString("mp4downloader", "error_generic", ["saveVideo", err.toString()]));
                dir.append(this.util.getString("mp4downloader", "video") + ".mp4");
            }
            
            var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
            var uri = io.newURI(targetURL, null, null);
            var target = io.newFileURI(dir);
            
            var isPrivate = null, privacyContext = null;
            try {
                // If all this fails, we'll know it's an older version and we should use the older versions of transfer.init and persist.saveURI
                if (typeof PrivateBrowsingUtils == "undefined") Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
                isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
                privacyContext = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                       .getInterface(Components.interfaces.nsIWebNavigation)
                                       .QueryInterface(Components.interfaces.nsILoadContext);
            } catch (err) {
                this.util.log("Not using Private Browsing params...\n" + err);
            }
            
            var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);
            var transfer = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);
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
            return this.promptAndSave(targetURL, videoTitle, refer);
        }
    },
    
    promptAndSave: function (targetURL, videoTitle, refer) {
        var oldIFI = initFileInfo;
        try {
            initFileInfo = function (aFI, aURL, aDocument, aContentType, aContentDisposition) {
            //initFileInfo = function (aFI, aURL, aURLCharset, aDocument, aContentType, aContentDisposition) {
                aFI.uri = makeURI(targetURL);
                aFI.fileName = videoTitle;
                aFI.fileExt = "mp4";
                aFI.fileBaseName = videoTitle;
            };
            saveURL(targetURL, "", "", false, false, makeURI(refer), document);
            initFileInfo = oldIFI;
            return true;
        } catch (err) {
            this.util.error(this.util.getString("mp4downloader", "error_generic", ["promptAndSave", err.toString()]));
            // Set this back to what it was (just in case)
            initFileInfo = oldIFI;
            return false;
        }
    },
    
    
    /* CONTEXT MENU */
    // Show/hide context menu items
    checkContextMenu: function () {
        if (window.content.location && window.content.location.href != "about:blank") {
            var host = window.content.location.hostname;
            var path = window.content.location.pathname;
            var query = "&" + window.content.location.search.substring(1);
            var hash = window.content.location.hash;
            
            // Should we show context menu entry for video page?
            if (mpUtils.prefs.getBoolPref("contextmenu")) {
                var isVideoPage = false;
                // YouTube
                if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && (path == "/watch" || window.content.document.getElementById("channel-body") || (window.content.document.getElementById("page") && window.content.document.getElementById("page").className.indexOf("channel") != -1))) isVideoPage = true;
                
                // Dailymotion
                if (host.substring(host.length - 15) == "dailymotion.com" && path.substring(0, 6) == "/video") isVideoPage = true;
                
                // Vimeo
                // TODO: CouchMode
                if (host.substring(host.length - 9) == "vimeo.com" && path.search(/^\/([0-9]+)/) != -1) isVideoPage = true;
                
                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", !isVideoPage);
            } else {
                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
            }
            
            // Should we show context menu entry for video link?
            if (mpUtils.prefs.getBoolPref("linkcontextmenu") && window.document && window.document.popupNode) {
                var popupTarget = window.document.popupNode;
                while (popupTarget && popupTarget.nodeName && popupTarget.nodeName.toLowerCase() != "a") {
                    popupTarget = popupTarget.parentNode;
                }
                if (popupTarget && popupTarget.getAttribute && popupTarget.getAttribute("href")) {
                    var href = popupTarget.getAttribute("href");
                    if (href.substring(0, 11) != "javascript:" && href.substring(0, 7) != "mailto:" && href.substring(0, 6) != "about:" && href.substring(0, 1) != "#") {
                        var linkURL = this.util.makeURL(popupTarget.getAttribute("href"), window.content.location.href).spec;
                        if (linkURL) {
                            var linkHost = this.util.getFromString(linkURL, "://", "/");
                            var linkPath = this.util.getFromString(linkURL, "://");
                            linkPath = linkPath.substring(linkPath.indexOf("/"));
                            if (linkHost.substring(linkHost.length - 10) == "google.com" && linkPath.substring(0, 5) == "/url?") {
                                // This is a Google search result redirection
                                var origURL = this.util.getFromString(linkURL, "?url=", "&") || this.util.getFromString(linkURL, "&url=", "&") ||
                                              this.util.getFromString(linkURL, "?q=",   "&") || this.util.getFromString(linkURL, "&q=",   "&");
                                if (origURL) {
                                    origURL = decodeURIComponent(origURL);
                                    if (origURL.indexOf("://") != -1) {
                                        linkURL = origURL;
                                        linkHost = this.util.getFromString(linkURL, "://", "/");
                                        linkPath = this.util.getFromString(linkURL, "://");
                                        linkPath = linkPath.substring(linkPath.indexOf("/"));
                                    }
                                }
                            }
                            if (linkHost.substring(linkHost.length - 12) == "facebook.com" && linkPath.substring(0, 7) == "/l.php?") {
                                // This is a Facebook link redirection
                                var origURL = this.util.getFromString(linkURL, "?u=", "&") || this.util.getFromString(linkURL, "&u=", "&");
                                if (origURL) {
                                    origURL = decodeURIComponent(origURL);
                                    if (origURL.indexOf("://") != -1) {
                                        linkURL = origURL;
                                        linkHost = this.util.getFromString(linkURL, "://", "/");
                                        linkPath = this.util.getFromString(linkURL, "://");
                                        linkPath = linkPath.substring(linkPath.indexOf("/"));
                                    }
                                }
                            }
                            
                            if (linkHost.substring(linkHost.length - 12) == "facebook.com" && linkPath.indexOf("#!") != -1) {
                                linkPath = this.util.getFromString(linkPath, "#!");
                            }
                            
                            if (((linkHost.substring(linkHost.length - 11) == "youtube.com" || linkHost.substring(linkHost.length - 20) == "youtube-nocookie.com") && linkPath.substring(0, 6) == "/watch") ||
                                    (linkHost.substring(linkHost.length - 15) == "dailymotion.com" && linkPath.substring(0, 6) == "/video") ||
                                    // TODO: CouchMode
                                    (linkHost.substring(linkHost.length - 9) == "vimeo.com" && linkPath.match(/^\/([0-9]+)/))) {
                                
                                // Show the context menu button
                                document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", false);
                                // Set vars on mp4downloader_linkcontextmenu
                                document.getElementById("mp4downloader_linkcontextmenu").setAttribute("videopage", linkURL);
                                document.getElementById("mp4downloader_linkcontextmenu").setAttribute("referpage", window.content.location.href);
                                // Hide other context menu button to avoid confusion
                                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
                            } else {
                                // Hide both context menu buttons to avoid confusion
                                document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
                                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
                            }
                        } else {
                            // Hide both context menu buttons to avoid confusion
                            document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
                            document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
                        }
                    } else {
                        // Hide both context menu buttons to avoid confusion
                        document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
                        document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
                    }
                } else {
                    document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
                }
            } else {
                document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
            }
        } else {
            // We are on about:blank, so just hide both context menu buttons
            document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
            document.getElementById("mp4downloader_linkcontextmenu").setAttribute("hidden", true);
        }
    },
    
    // Download video from a link's context menu
    linkContextMenuCommand: function () {
        var pageURL = document.getElementById("mp4downloader_linkcontextmenu").getAttribute("videopage");
        var host = this.util.getFromString(pageURL, "://", "/");
        var path = this.util.getFromString(pageURL, "://");
        path = path.substring(path.indexOf("/"));
        
        // YouTube
        if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && path.substring(0, 6) == "/watch") {
            this.ajax.youtube(this.util.getFromString(pageURL, "?v=", "&") || this.util.getFromString(pageURL, "&v=", "&"), document.getElementById("mp4downloader_linkcontextmenu").getAttribute("referpage"));
        }
        
        // Dailymotion
        if (host.substring(host.length - 15) == "dailymotion.com" && path.substring(0, 6) == "/video") {
            this.ajax.dailymotion(this.util.getFromString(pageURL, "/video/", "_"));
        }
        
        // Vimeo
        if (host.substring(host.length - 9) == "vimeo.com" && path.search(/^\/([0-9]+)/) != -1) {
            this.ajax.vimeo(path.match(/^\/([0-9]+)/)[1], document.getElementById("mp4downloader_linkcontextmenu").getAttribute("referpage"));
        }
    },
    
    
    /* EMBEDDED VIDEOS */
    // Embed a download button below an embed and tag lower objects
    embedDownloadButton: function (obj, contentWindow, clickFunc) {
        var elem = contentWindow.document.createElement("button");
        elem.setAttribute("type", "button");
        elem.className = "mp4downloader_btnFor" + (obj.nodeName.toLowerCase() == "iframe" ? "IFrame" : obj.nodeName.toUpperCase().substring(0, 1) + obj.nodeName.toLowerCase().substring(1)) + " " + elem.className;
        elem.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "downloadBtnLabel")));
        elem.addEventListener("click", function () {
            clickFunc.ajaxFunc.apply(mp4downloader, clickFunc.ajaxArgs);
        }, false);
        
        var elemHolder = contentWindow.document.createElement("div");
        try {
            if (obj.parentNode.nodeName.toLowerCase() != "center") {
                if (obj.getAttribute("width")) {
                    elemHolder.style.width = obj.getAttribute("width") + "px";
                }
                if (obj.style.width) {
                    elemHolder.style.width = obj.style.width;
                }
                elemHolder.style.textAlign = "center";
            }
        } catch (err) {}
        elemHolder.appendChild(elem);
        
        var parent = obj.parentNode;
        var nextElement = obj.nextSibling;
        if (parent.nodeName.toLowerCase() == "div" && parent.className.indexOf("swfObject") != -1 && parent.style.height.substring(parent.style.height.length - 2) == "px") {
            // Mostly Facebook-specific, to prevent weird spacing for embeds in news feed
            this.util.log("Detected swfObject DIV - moving to parent");
            nextElement = parent.nextSibling;
            parent = parent.parentNode;
        }
        parent.insertBefore(elemHolder, nextElement);
        obj.className = "mp4downloader_embedButtonInitialized " + obj.className;
        
        // If <object>, then tag lower <embed>s
        if (obj.nodeName.toLowerCase() == "object") {
            var embedsBelow = obj.getElementsByTagName("embed");
            for (var i = 0; i < embedsBelow.length; i++) {
                embedsBelow[i].className = "mp4downloader_tagChecked mp4downloader_embedOnObject " + embedsBelow[i].className;
            }
        }
    },
    
    // Place a download button below supported embedded videos
    // (If noEmbed is true, we won't put a D/L button below embeds and instead return clickFunc details for the first embed we find)
    getEmbeddedVideos: function (contentWindow, noEmbed) {
        if (!contentWindow) {
            contentWindow = window.content;
        }
        var contentHost = contentWindow.location.hostname;
        var contentPath = contentWindow.location.pathname;
        
        var foundVideos = false;
        
        // Search for iframe embeds
        var iframes = contentWindow.document.getElementsByTagName("iframe");
        for (var i = 0; i < iframes.length; i++) {
            // Was this tag already checked?
            if (iframes[i].className.indexOf("mp4downloader_tagChecked") == -1) {
                iframes[i].className = "mp4downloader_tagChecked " + iframes[i].className;
                if (iframes[i].getAttribute("src")) {
                    let embedURL = iframes[i].getAttribute("src");
                    if (embedURL) {
                        embedURL = this.util.makeURL(embedURL, contentWindow.location.href).spec;
                        let embedURLhost = this.util.getFromString(embedURL, "://", "/");
                        if (embedURLhost) {
                            let embedURLpath = this.util.getFromString(embedURL, "://");
                            embedURLpath = embedURLpath.substring(embedURLpath.indexOf("/"));
                            
                            // YouTube (no internal YouTube pages)
                            if ((contentHost.substring(contentHost.length - 11) != "youtube.com" && contentHost.substring(contentHost.length - 20) != "youtube-nocookie.com") && (embedURLhost.substring(embedURLhost.length - 11) == "youtube.com" || embedURLhost.substring(embedURLhost.length - 20) == "youtube-nocookie.com") && embedURLpath.substring(0, 7) == "/embed/") {
                                let clickFunc = {
                                    ajaxFunc: this.ajax.youtube,
                                    ajaxArgs: [
                                        this.util.getFromString(embedURLpath, "/embed/" + (embedURLpath.substring(7, 9) == "v/" ? "v/" : ""), "?"),
                                        contentWindow.location.href
                                    ]
                                };
                                if (noEmbed) {
                                    return clickFunc;
                                } else {
                                    this.embedDownloadButton(iframes[i], contentWindow, clickFunc);
                                    foundVideos = true;
                                }
                            }
                            
                            // Dailymotion
                            if ((contentHost.substring(contentHost.length - 15) != "dailymotion.com" || contentPath.substring(0, 6) != "/video") && embedURLhost.substring(embedURLhost.length - 15) == "dailymotion.com" && embedURLpath.substring(0, 7) == "/embed/") {
                                let clickFunc = {
                                    ajaxFunc: this.ajax.dailymotion,
                                    ajaxArgs: [
                                        this.util.getFromString(embedURLpath, (embedURLpath.substring(0, 13) == "/embed/video/" ? "/embed/video/" : "/embed/"), "?")
                                    ]
                                };
                                if (noEmbed) {
                                    return clickFunc;
                                } else {
                                    this.embedDownloadButton(iframes[i], contentWindow, clickFunc);
                                    foundVideos = true;
                                }
                            }
                            
                            // Vimeo
                            if ((contentHost.substring(contentHost.length - 9) != "vimeo.com" || contentPath.search(/^\/([0-9]+)/) == -1) && embedURLhost.substring(embedURLhost.length - 16) == "player.vimeo.com" && embedURLpath.substring(0, 7) == "/video/") {
                                let clickFunc = {
                                    ajaxFunc: this.ajax.vimeo,
                                    ajaxArgs: [
                                        this.util.getFromString(embedURLpath, "/video/", "?").match(/([0-9]+)/)[1],
                                        contentWindow.location.href
                                    ]
                                };
                                if (noEmbed) {
                                    return clickFunc;
                                } else {
                                    this.embedDownloadButton(iframes[i], contentWindow, clickFunc);
                                    foundVideos = true;
                                }
                            }
                            
                            // Facebook referer frame (may contain an embed from another video site that Facebook sticks inside an iframe to prevent the embed from getting the URL of the current page via HTTP referer)
                            if (embedURLhost.substring(embedURLhost.length - 12) == "facebook.com" && embedURLpath.substring(embedURLpath.length - 17) == "referer_frame.php") {
                                this.util.log("Found referer frame");
                                let iframeContentWindow = iframes[i].contentDocument.defaultView;
                                let clickFunc = this.getEmbeddedVideos(iframeContentWindow, true);
                                if (clickFunc) {
                                    this.embedDownloadButton(iframes[i], contentWindow, clickFunc);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Search for <object> embeds
        var objects = contentWindow.document.getElementsByTagName("object");
        for (var j = 0; j < objects.length; j++) {
            // Was this tag already checked?
            if (objects[j].className.indexOf("mp4downloader_tagChecked") == -1) {
                objects[j].className = "mp4downloader_tagChecked " + objects[j].className;
                let flashvars = "";
                let embedURL = "";
                let params = objects[j].getElementsByTagName("param");
                for (var jA = 0; jA < params.length; jA++) {
                    switch (params[jA].getAttribute("name").toLowerCase()) {
                    case "movie":
                        if (!embedURL) {
                            embedURL = params[jA].getAttribute("value");
                        }
                        break;
                    case "flashvars":
                        flashvars += "&" + params[jA].getAttribute("value");
                        break;
                    }
                }
                if (!embedURL) {
                    try {
                        embedURL = objects[j].getAttribute("data");
                    } catch (err) {}
                }
                if (embedURL) {
                    embedURL = this.util.makeURL(embedURL, contentWindow.location.href).spec;
                    if (embedURL.indexOf("?") != -1) {
                        flashvars += "&" + this.util.getFromString(embedURL, "?");
                        embedURL = embedURL.substring(0, embedURL.indexOf("?"));
                    }
                    let embedURLhost = this.util.getFromString(embedURL, "://", "/");
                    if (embedURLhost) {
                        let embedURLpath = this.util.getFromString(embedURL, "://");
                        embedURLpath = embedURLpath.substring(embedURLpath.indexOf("/"));
                        
                        // YouTube (including internal YouTube pages)
                        if (((contentHost.substring(contentHost.length - 11) != "youtube.com" && contentHost.substring(contentHost.length - 20) != "youtube-nocookie.com") || (contentPath.substring(0, 6) != "/watch" && !contentWindow.document.getElementById("channel-body") && (!contentWindow.document.getElementById("page") || contentWindow.document.getElementById("page").className.indexOf("channel") == -1))) && (embedURLhost.substring(embedURLhost.length - 11) == "youtube.com" || embedURLhost.substring(embedURLhost.length - 20) == "youtube-nocookie.com" || embedURLhost.substring(embedURLhost.length - 9) == "ytimg.com") && (embedURLpath.indexOf("/v/") != -1 || embedURLpath.indexOf("/p/") != -1)) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.youtube,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, "/v/", "&"),
                                    contentWindow.location.href
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(objects[j], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        
                        // Dailymotion
                        if ((contentHost.substring(contentHost.length - 15) != "dailymotion.com" || contentPath.substring(0, 6) != "/video") && embedURLhost.substring(embedURLhost.length - 15) == "dailymotion.com") {
                            let clickFunc = {
                                ajaxFunc: this.ajax.dailymotion,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, (embedURLpath.indexOf("/swf/video/") != -1 ? "/swf/video/" : "/swf/"), "?")
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(objects[j], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        
                        // Vimeo
                        if ((contentHost.substring(contentHost.length - 9) != "vimeo.com" || (contentPath.substring(0, 11) != "/couchmode/" && contentPath.search(/^\/([0-9]+)/) == -1)) && embedURLhost.substring(embedURLhost.length - 9) == "vimeo.com" && flashvars.indexOf("&clip_id=") != -1) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.vimeo,
                                ajaxArgs: [
                                    this.util.getFromString(flashvars, "&clip_id=", "&"),
                                    contentWindow.location.href
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(objects[j], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                    }
                }
            }
        }
        
        // Search for <embed> embeds
        var embeds = contentWindow.document.getElementsByTagName("embed");
        for (var k = 0; k < embeds.length; k++) {
            // Was this tag already checked?
            if (embeds[k].className.indexOf("mp4downloader_tagChecked") == -1) {
                embeds[k].className = "mp4downloader_tagChecked " + embeds[k].className;
                let flashvars = embeds[k].getAttribute("flashvars") ? "&" + embeds[k].getAttribute("flashvars") : "";
                let embedURL = embeds[k].getAttribute("src");
                if (embedURL) {
                    embedURL = this.util.makeURL(embedURL, contentWindow.location.href).spec;
                    if (embedURL.indexOf("?") != -1) {
                        flashvars += "&" + this.util.getFromString(embedURL, "?");
                        embedURL = embedURL.substring(0, embedURL.indexOf("?"));
                    }
                    let embedURLhost = this.util.getFromString(embedURL, "://", "/");
                    if (embedURLhost) {
                        let embedURLpath = this.util.getFromString(embedURL, "://");
                        embedURLpath = embedURLpath.substring(embedURLpath.indexOf("/"));
                        
                        // YouTube (no internal YouTube pages)
                        if ((contentHost.substring(contentHost.length - 11) != "youtube.com" && contentHost.substring(contentHost.length - 20) != "youtube-nocookie.com") && (embedURLhost.substring(embedURLhost.length - 11) == "youtube.com" || embedURLhost.substring(embedURLhost.length - 20) == "youtube-nocookie.com" || embedURLhost.substring(embedURLhost.length - 9) == "ytimg.com")) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.youtube,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, "/v/", "&"),
                                    contentWindow.location.href
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(embeds[k], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        
                        // Dailymotion
                        if ((contentHost.substring(contentHost.length - 15) != "dailymotion.com" || contentPath.substring(0, 6) != "/video") && embedURLhost.substring(embedURLhost.length - 15) == "dailymotion.com") {
                            let clickFunc = {
                                ajaxFunc: this.ajax.dailymotion,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, (embedURLpath.indexOf("/swf/video/") != -1 ? "/swf/video/" : "/swf/"), "?")
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(embeds[k], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        
                        // Vimeo
                        if ((contentHost.substring(contentHost.length - 9) != "vimeo.com" || (contentPath.substring(0, 11) != "/couchmode/" && contentPath.search(/^\/([0-9]+)/) == -1)) && embedURLhost.substring(embedURLhost.length - 9) == "vimeo.com" && flashvars.indexOf("&clip_id=") != -1) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.vimeo,
                                ajaxArgs: [
                                    this.util.getFromString(flashvars, "&clip_id=", "&"),
                                    contentWindow.location.href
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(embeds[k], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                    }
                }
            }
        }
        
        return foundVideos;
    },
    
    // Embed button inside video page
    embedBtnOnVideo: function (contentWindow) {
        var host = contentWindow.location.hostname;
        var path = contentWindow.location.pathname;
        var query = "&" + contentWindow.location.search.substring(1);
        var hash = contentWindow.location.hash;
        try {
            // YouTube
            if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && path == "/watch") {
                let dlBtn = contentWindow.document.createElement("button");
                dlBtn.addEventListener("click", function () {
                    mp4downloader.mp4download(null, contentWindow);
                }, false);
                if (contentWindow.document.getElementById("watch-headline-title")) {
                    // Normal YouTube page
                    dlBtn.className = "yt-uix-button yt-uix-button-text yt-uix-button-size-default yt-uix-tooltip yt-uix-tooltip-reverse";
                    dlBtn.style.cssFloat = "right";
                    dlBtn.setAttribute("title", this.util.getString("mp4downloader", "downloadBtnLabel"));
                    dlBtn.setAttribute("type", "button");
                    dlBtn.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "download")));
                    let h1 = contentWindow.document.getElementById("watch-headline-title");
                    h1.insertBefore(dlBtn, h1.firstChild);
                    if (h1.parentNode.className.indexOf("yt-uix-expander-collapsed") != -1) {
                        let index = h1.parentNode.className.indexOf("yt-uix-expander-collapsed");
                        let before = h1.parentNode.className.substring(0, index);
                        let after = h1.parentNode.className.substring(index + "yt-uix-expander-collapsed".length);
                        h1.parentNode.className = before + " " + after;
                    }
                } else if (contentWindow.document.getElementById("vo")) {
                    // Feather beta
                    dlBtn.className = "b";
                    dlBtn.style.cssText = "margin-left: 10px; padding: 4px 6px;";
                    // For image inside, use:
                    //let span = contentWindow.document.createElement("span");
                    //span.style.cssText = "display: inline-block; height: 12px; margin-right: 3px; width: 12px; background: url(...) no-repeat;";
                    //dlBtn.appendChild(span);
                    dlBtn.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "download")));
                    contentWindow.document.getElementById("vo").appendChild(dlBtn);
                } else {
                    // No clue...
                    // NOTE: We're only logging this (not showing it to user) because it can occur when a subframe on a YT page doesn't have a real URL (it seems to inherit its parent's), and there is definitely no button container inside the iframe
                    mpUtils.log("No button container inside YouTube page");
                }
            /*
            // YouTube User Channel
            } else if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && (contentWindow.document.getElementById("channel-body") || (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1))) {
                // Because of the diversity of user channels, this is not yet implemented...
            */
            // Dailymotion
            } else if (host.substring(host.length - 15) == "dailymotion.com" && path.substring(0, 6) == "/video") {
                if (contentWindow.document.getElementsByClassName("pl_video_tabs").length > 0) {
                    let dlBtn = contentWindow.document.createElement("a");
                    dlBtn.className = "foreground2 video_title_on_hover";
                    dlBtn.href = "javascript:void(0);";
                    dlBtn.setAttribute("title", mpUtils.getString("mp4downloader", "downloadBtnLabel"));
                    dlBtn.appendChild(contentWindow.document.createTextNode(mpUtils.getString("mp4downloader", "download")));
                    dlBtn.addEventListener("click", function () {
                        mp4downloader.mp4download(null, contentWindow);
                    }, false);
                    let dlHost = contentWindow.document.createElement("li");
                    dlHost.appendChild(dlBtn);
                    contentWindow.document.getElementsByClassName("pl_video_tabs")[0].getElementsByTagName("ul")[0].appendChild(dlHost);
                }
            // Vimeo
            } else if (host.substring(host.length - 9) == "vimeo.com" && path.match(/^\/([0-9]+)/)) {
                // TODO: CouchMode
                let dlBtn = contentWindow.document.createElement("a");
                dlBtn.className = "btn";
                dlBtn.href = "javascript:void(0)";
                dlBtn.setAttribute("title", this.util.getString("mp4downloader", "downloadBtnDescription"));
                dlBtn.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "downloadBtnLabel")));
                dlBtn.addEventListener("click", function () {
                    mp4downloader.mp4download(null, contentWindow);
                }, false);
                if (contentWindow.document.getElementById("tools").getElementsByTagName("div").length > 0) {
                    contentWindow.document.getElementById("tools").insertBefore(dlBtn, contentWindow.document.getElementById("tools").getElementsByTagName("div")[0]);
                } else {
                    contentWindow.document.getElementById("tools").appendChild(dlBtn);
                }
            }
        } catch (err) {
            mpUtils.log("embedBtnOnVideo Error: " + err + "\nLine: " + err.lineNumber);
        }
    }
};


// Listener to run all onload functions
window.addEventListener("load", function () {
    // Place download button below embedded videos and place download button inside video page
    // TODO: Move this into mp4downloader namespace or modularize (it could be great if we could also support e10s and modularize site backends during this change)
    // NOTE: retryTimeout is only used for Facebook (since, after history.pushState(), it might take a few tries until we get a loaded page) ... and, since Facebook support isn't really working anyway... (finish this statement)
    var contentLoadedFunc = function (contentWindow, retryTimeout) {
        if (contentWindow && contentWindow.location && contentWindow.location.href.indexOf("://") != -1 &&
            contentWindow.document && typeof contentWindow.document.getElementById == "function") {
            var host = contentWindow.location.hostname;
            var path = contentWindow.location.pathname;
            
            // Modify history.pushState so we can detect when history is modified but new page is not loaded (FF4+)
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
                                contentLoadedFunc(contentWindow, 500);
                            }, 500);
                        };
                        
                        contentWindow.addEventListener("popstate", function () {
                            setTimeout(function () {
                                contentLoadedFunc(contentWindow, 500);
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
                    mp4downloader.getEmbeddedVideos(contentWindow);
                }
            }
            
            // Place button inside video page
            if (mpUtils.prefs.getBoolPref("embedBtnOnVideo")) {
                if (mp4downloader.embedBtnOnVideo(contentWindow) == "retry") {
                    // Retry (FB probably isn't loaded correctly yet)
                    if (retryTimeout && retryTimeout < 10000) {
                        setTimeout(function () {
                            contentLoadedFunc(contentWindow, retryTimeout + (retryTimeout / 2));
                        }, retryTimeout);
                    }
                }
            }
        }
    };
    gBrowser.addEventListener("DOMContentLoaded", function (event) {
        if (event && event.originalTarget && event.originalTarget instanceof HTMLDocument) {
            //var contentDocument = event.originalTarget.wrappedJSObject || event.originalTarget;
            var contentDocument = event.originalTarget;
            var contentWindow = contentDocument.defaultView;
            if (contentWindow) {
                contentLoadedFunc(contentWindow);
            }
        }
    }, false);
}, false);
