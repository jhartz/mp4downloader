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
