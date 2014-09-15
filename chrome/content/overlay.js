/*
    Copyright (C) 2014  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

// A list of common variable names used here is available at:
// https://github.com/jhartz/mp4downloader/wiki/Code-Variables

var mp4downloader = {
    // Detect and downloads videos from supported sites (used by toolbar button, context menu, and more)
    mp4download: function (event, contentWindow) {
        // Make sure button was not right-clicked (if it was clicked)
        if (!event || (event && !event.type) || (event && event.type && ((event.type != "click") || (event.type == "click" && event.which == 1)))) {
            // Make sure contentWindow is set
            if (!contentWindow) {
                contentWindow = window.content;
            }
            
            // Check to make sure we are on a "real" website (mostly just blocking out "about:" pages)
            if (contentWindow && contentWindow.location && contentWindow.location.toString().indexOf("://") != -1 &&
                contentWindow.document && typeof contentWindow.document.getElementById == "function") {
                var host = contentWindow.location.hostname;
                var path = contentWindow.location.pathname;
                var query = "&" + contentWindow.location.search.substring(1);
                var hash = contentWindow.location.hash;
                
                // YouTube (video page or user channel)
                if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && (path == "/watch" || contentWindow.document.getElementById("channel-body") || (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1))) {
                    var flashvars;
                    if (contentWindow.document.getElementById("movie_player") || contentWindow.document.getElementById("movie_player-flash")) {
                        try {
                            flashvars = (contentWindow.document.getElementById("movie_player") || contentWindow.document.getElementById("movie_player-flash")).getAttribute("flashvars");
                        } catch (err) {}
                        if (!flashvars) {
                            // Try getting flashvars as if movie_player is an <object>
                            try {
                                flashvars = (contentWindow.document.getElementById("movie_player") || contentWindow.document.getElementById("movie_player-flash")).getElementsByName("flashvars")[0].getAttribute("value");
                            } catch (err) {}
                        }
                    }
                    
                    if (!flashvars) {
                        // If we have nothing, let's go snooping around YouTube's JavaScript...
                        // (unfortunately ... wrappedJSObject ... https://developer.mozilla.org/en/XPCNativeWrapper#Accessing_unsafe_properties)
                        try {
                            if (contentWindow.wrappedJSObject && contentWindow.wrappedJSObject.yt && contentWindow.wrappedJSObject.yt.config_ && contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG && contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args && typeof contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args == "object") {
                                this.util.log("Using yt.config to find flashvars");
                                var flashvarList = [];
                                for (var prop in contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args) {
                                    if (contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args.hasOwnProperty(prop) && typeof contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args[prop] == "string") {
                                        flashvarList.push(prop + "=" + encodeURIComponent(contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args[prop]));
                                    }
                                }
                                
                                if (flashvarList.length > 0) {
                                    flashvars = flashvarList.join("&");
                                }
                            }
                        } catch (err) {}
                        
                        // If we still have nothing, try and find the flashvars somewhere in the page
                        if (!flashvars) {
                            try {
                                var allBody = contentWindow.document.documentElement.innerHTML;
                                var flashvarsCount = allBody.match(/flashvars="/g).length;
                                if (flashvarsCount == 1) {
                                    // We'll assume this is the movie player
                                    flashvars = this.util.getFromString(allBody, 'flashvars="', '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                                } else if (flashvarsCount > 1) {
                                    // Try to find the movie player
                                    while (allBody.indexOf('flashvars="') != -1) {
                                        allBody = this.util.getFromString(allBody, 'flashvars="');
                                        var tempFlashvars = this.util.getFromString(allBody, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                                        allBody = this.util.getFromString(allBody, '"');
                                        
                                        if (tempFlashvars.indexOf("&video_id=") != -1) {
                                            // Let's assume this is it (but still go through the rest in case we find a better cantidate)
                                            flashvars = tempFlashvars;
                                        }
                                    }
                                }
                            } catch (err) {}
                        }
                    }
                    
                    // Makes it easier to find stuff in here later on
                    if (flashvars) flashvars = "&" + flashvars;
                    
                    // Try and get Video ID
                    var videoID;
                    if (flashvars && flashvars.indexOf("&video_id=") != -1) {
                        videoID = this.util.getFromString(flashvars, "&video_id=", "&");
                    } else if (contentWindow.document.documentElement.innerHTML.indexOf("&video_id=") != -1) {
                        videoID = this.util.getFromString(contentWindow.document.documentElement.innerHTML, "&video_id=", "&");
                    } else if (contentWindow.document.documentElement.innerHTML.indexOf('"video_id": "') != -1) {
                        videoID = this.util.getFromString(contentWindow.document.documentElement.innerHTML, '"video_id": "', '"');
                    } else if (query.indexOf("&v=") != -1) {
                        videoID = this.util.getFromString(query, "&v=", "&");
                    } else {
                        // Search for tags with the name "video_id" (very last resort)
                        var namedTags = contentWindow.document.getElementsByName("video_id");
                        if (namedTags.length > 0) {
                            for (var i = 0; i < namedTags.length; i++) {
                                if (namedTags[i].getAttribute("value")) {
                                    videoID = namedTags[i].getAttribute("value");
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (videoID) {
                        if (flashvars) {
                            // TODO: This section could be improved
                            var videoTitle;
                            if (flashvars && flashvars.indexOf("&title=") != -1) {
                                videoTitle = decodeURIComponent(this.util.getFromString(flashvars, "&title=", "&").replace(/\+/g, " "));
                            } else if (contentWindow.document.getElementById("channel-body") || (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1)) {
                                if (contentWindow.document.getElementById("playnav-curvideo-title")) {
                                    videoTitle = this.util.trimString(contentWindow.document.getElementById("playnav-curvideo-title").textContent);
                                } else if (contentWindow.document.getElementsByClassName("channels-featured-video-details").length > 0 || contentWindow.document.getElementsByClassName("video-detail").length > 0) {
                                    let dets = contentWindow.document.getElementsByClassName("channels-featured-video-details");
                                    if (dets.length == 0) dets = contentWindow.document.getElementsByClassName("video-detail");
                                    for (var i = 0; i < dets.length; i++) {
                                        if (dets[i].getElementsByClassName("title").length > 0) {
                                            videoTitle = this.util.trimString(dets[i].getElementsByClassName("title")[0].getElementsByTagName("a")[0].textContent);
                                        }
                                    }
                                }
                            } else if (contentWindow.document.getElementById("eow-title") && contentWindow.document.getElementById("eow-title").getAttribute("title")) {
                                videoTitle = contentWindow.document.getElementById("eow-title").getAttribute("title");
                            } else if (contentWindow.document.title.substring(contentWindow.document.title.length - 10) == " - YouTube") {
                                videoTitle = contentWindow.document.title.substring(0, contentWindow.document.title.length - 10);
                            } else if (contentWindow.document.title.indexOf("YouTube - ") == 0) {
                                videoTitle = contentWindow.document.title.substring(10);
                            }
                            
                            var videoAuthor;
                            if (flashvars && flashvars.indexOf("&author=") != -1) {
                                videoAuthor = decodeURIComponent(this.util.getFromString(flashvars, "&author=", "&"));
                            } else if (contentWindow.document.getElementById("watch-username")) {
                                videoAuthor = this.util.trimString(contentWindow.document.getElementById("watch-username").textContent);
                            } else if (contentWindow.document.getElementById("un")) {
                                // Feather
                                videoAuthor = this.util.trimString(contentWindow.document.getElementById("un").textContent);
                            } else if (contentWindow.document.getElementById("watch-uploader-info") && contentWindow.document.getElementById("watch-uploader-info").getElementsByClassName("author").length > 0) {
                                videoAuthor = this.util.trimString(contentWindow.document.getElementById("watch-uploader-info").getElementsByClassName("author")[0].textContent);
                            } else if (contentWindow.document.getElementById("de") && contentWindow.document.getElementById("de").getElementsByClassName("author").length > 0) {
                                // Feather
                                videoAuthor = this.util.trimString(contentWindow.document.getElementById("de").getElementsByClassName("author")[0].textContent);
                            }
                            
                            if (flashvars.indexOf("&fmt_url_map=") != -1 || flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                                var fmt18url, fmt22url, fmt37url;
                                if (flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                                    // Parse fmt_stream_map (kinda like fmt_url_map) - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                                    var fmt_url_map = decodeURIComponent(this.util.getFromString(flashvars, "&url_encoded_fmt_stream_map=", "&")).split(",");
                                    for (var i = 0; i < fmt_url_map.length; i++) {
                                        var format, url, sig;
                                        var fmt_vars = fmt_url_map[i].split("&");
                                        for (var j = 0; j < fmt_vars.length; j++) {
                                            if (fmt_vars[j].substring(0, 4) == "itag") {
                                                format = fmt_vars[j].substring(5);
                                            } else if (fmt_vars[j].substring(0, 3) == "url") {
                                                url = decodeURIComponent(fmt_vars[j].substring(4));
                                            } else if (fmt_vars[j].substring(0, 3) == "sig") {
                                                sig = decodeURIComponent(fmt_vars[j].substring(4));
                                            }
                                        }
                                        url += "&signature=" + sig;
                                        if (format == "18") { // Normal quality
                                            fmt18url = url;
                                        }
                                        if (format == "22") { // 720p
                                            fmt22url = url;
                                        }
                                        if (format == "37") { // 1080p
                                            fmt37url = url;
                                        }
                                    }
                                } else {
                                    // Parse fmt_url_map (Format-URL Map) - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                                    var fmt_url_map = decodeURIComponent(this.util.getFromString(flashvars, "&fmt_url_map=", "&")).split(",");
                                    for (var i = 0; i < fmt_url_map.length; i++) {
                                        var format = fmt_url_map[i].substring(0, 2);
                                        if (format == "18") { // Normal quality
                                            fmt18url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                        }
                                        if (format == "22") { // 720p
                                            fmt22url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                        }
                                        if (format == "37") { // 1080p
                                            fmt37url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                        }
                                    }
                                }
                                if ((mp4downloader.util.prefs.getBoolPref("hq") || !fmt18url) && (fmt22url || fmt37url)) {
                                    if (fmt37url) {
                                        this.util.log("YouTube format: 37 (1080p)");
                                        this.saveVideo(fmt37url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", true);
                                    } else if (fmt22url) {
                                        this.util.log("YouTube format: 22 (720p)");
                                        this.saveVideo(fmt22url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", true);
                                    }
                                } else {
                                    this.util.log("YouTube format: 18 (normal quality)");
                                    if (fmt18url) {
                                        this.saveVideo(fmt18url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", false);
                                    } else {
                                        // Fallback in case we cannot get a download URL from fmt_url_map
                                        /* OLD
                                        var token = null;
                                        if (this.util.getFromString(flashvars, "&token=", "&")) {
                                            token = this.util.getFromString(flashvars, "&token=", "&");
                                        } else if (this.util.getFromString(flashvars, "&t=", "&")) {
                                            token = this.util.getFromString(flashvars, "&t=", "&");
                                        } else {
                                        */
                                            this.ajax.youtube(videoID, contentWindow.location.href);
                                        /* OLD CONTINUED
                                        }
                                        if (token) {
                                            this.saveVideo("http://www.youtube.com/get_video?video_id=" + videoID + "&t=" + token + "&fmt=18&el=detailpage&asv=", "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", false);
                                        }
                                        */
                                    }
                                }
                            } else {
                                // Fallback in case we cannot find fmt_url_map
                                /* OLD
                                var token = null;
                                if (this.util.getFromString(flashvars, "&token=", "&")) {
                                    token = this.util.getFromString(flashvars, "&token=", "&");
                                } else if (this.util.getFromString(flashvars, "&t=", "&")) {
                                    token = this.util.getFromString(flashvars, "&t=", "&");
                                } else {
                                */
                                    this.ajax.youtube(videoID, contentWindow.location.href);
                                /* OLD CONTINUED
                                }
                                if (token) {
                                    var fmt = "18"; // Normal quality
                                    if (mp4downloader.util.prefs.getBoolPref("hq") && flashvars.indexOf("&fmt_map=") != -1) {
                                        var fmt_map_tmp = this.util.getFromString(flashvars, "&fmt_map=", "&");
                                        fmt_map_tmp = decodeURIComponent(fmt_map_tmp).split(",");
                                        var fmt_map = "";
                                        for (var i = 0; i < fmt_map_tmp.length; i++) {
                                            fmt_map += fmt_map_tmp[i].substring(0, fmt_map_tmp[i].indexOf("/")) + ":";
                                        }
                                        if (fmt_map.indexOf("37:") != -1) {
                                            fmt = "37"; // 1080p
                                        } else if (fmt_map.indexOf("22:") != -1) {
                                            fmt = "22"; // 720p
                                        }
                                        this.util.log("YouTube format: " + fmt);
                                    }
                                    this.saveVideo("http://www.youtube.com/get_video?video_id=" + videoID + "&t=" + token + "&fmt=" + fmt + "&el=detailpage&asv=", "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", ((fmt == "37" || fmt == "22") ? true : false));
                                }
                                */
                            }
                        } else {
                            // We have a video ID, so we can just fall back on this
                            this.util.log("No flashvars - falling back on video ID");
                            this.ajax.youtube(videoID, contentWindow.location.href);
                        }
                    } else {
                        // If we get here, no hope is left
                        this.util.error(this.util.getString("mp4downloader", "error_noplay", ["YouTube"]), "Video URL: " + contentWindow.location.href);
                    }
                }
                
                // Dailymotion (dailymotion.com/video/...)
                else if (host.substring(host.length - 15) == "dailymotion.com" && path.substring(0, 6) == "/video") {
                    // Not sure if all videos are under dailymotion.com/video/...
                    // Maybe just wait for a bug report to figure out an alternate URL pattern?
                    // (I think by now we can be pretty certain that they are all /video/...)
                    var flashvars, sequence;
                    var embeds = contentWindow.document.getElementsByTagName("embed");
                    for (var i = 0; i < embeds.length; i++) {
                        if (embeds[i] && embeds[i].getAttribute("id") && embeds[i].getAttribute("id").substring(0, 12) == "video_player" && embeds[i].getAttribute("flashvars")) {
                            flashvars = embeds[i].getAttribute("flashvars");
                        }
                    }
                    if (!flashvars) {
                        var objects = contentWindow.document.getElementsByTagName("object");
                        for (var i = 0; i < objects.length; i++) {
                            if (objects[i] && objects[i].getAttribute("id") && objects[i].getAttribute("id").substring(0, 12) == "video_player") {
                                var params = objects[i].getElementsByTagName("param");
                                if (params.length > 0) {
                                    for (var j = 0; j < params.length; j++) {
                                        if (params[j].getAttribute("name") == "flashvars") {
                                            flashvars = params[j].getAttribute("value");
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if (flashvars) sequence = decodeURIComponent(this.util.getFromString(flashvars, "&sequence=", "&"));
                    // TODO: We should modularize site backends (a JSM for each site) and then we can just make a parseSequence function so we can keep similar code between this function and the Dailymotion AJAX function without copy/pasting!
                    if (sequence) {
                        var videoTitle = this.util.trimString((contentWindow.document.getElementById("content") || contentWindow.document.getElementById("wrapper") || contentWindow.document.body || contentWindow.document).getElementsByTagName("h1")[0].textContent);
                        var videoAuthor = this.util.getFromString(sequence, '"videoOwnerLogin":"', '"').replace(/\\\//g, "/") || null;
                        
                        var videoURLs = [];
                        if (sequence.indexOf("sdURL") != -1) {
                            var sdURL = this.util.getFromString(sequence, '"sdURL":"', '"').replace(/\\\//g, "/");
                            if (sdURL && sdURL.indexOf(".mp4") != -1) videoURLs.push(sdURL);
                        }
                        if (sequence.indexOf("hqURL") != -1) {
                            var hqURL = this.util.getFromString(sequence, '"hqURL":"', '"').replace(/\\\//g, "/");
                            if (hqURL && hqURL.indexOf(".mp4") != -1) videoURLs.push(hqURL);
                        }
                        if (sequence.indexOf("hdURL") != -1) {
                            var hdURL = this.util.getFromString(sequence, '"hdURL":"', '"').replace(/\\\//g, "/");
                            if (hdURL && hdURL.indexOf(".mp4") != -1) videoURLs.push(hdURL);
                        }
                        if (sequence.indexOf("hd720URL") != -1) {
                            var hd720URL = this.util.getFromString(sequence, '"hd720URL":"', '"').replace(/\\\//g, "/");
                            if (hd720URL && hd720URL.indexOf(".mp4") != -1) videoURLs.push(hd720URL);
                        }
                        if (sequence.indexOf("hd1080URL") != -1) {
                            var hd1080URL = this.util.getFromString(sequence, '"hd1080URL":"', '"').replace(/\\\//g, "/");
                            if (hd1080URL && hd1080URL.indexOf(".mp4") != -1) videoURLs.push(hd1080URL);
                        }
                        
                        if (videoTitle && videoURLs.length > 0) {
                            if (mp4downloader.util.prefs.getBoolPref("hq")) {
                                // Get bottommost URL, which is the highest quality
                                this.saveVideo(videoURLs[videoURLs.length - 1], contentWindow.location.href, videoTitle, videoAuthor, "Dailymotion", true);
                                return;
                            } else {
                                // Get topmost URL, which is the lowest quality
                                this.saveVideo(videoURLs[0], contentWindow.location.href, videoTitle, videoAuthor, "Dailymotion", false);
                                return;
                            }
                        }
                    }
                    
                    // If we're here, then no video was saved
                    // (video ID is just path without "/video/" at beginning)
                    this.ajax.dailymotion(path.substring(7));
                }
                
                // Vimeo (vimeo.com/...)
                else if (host.substring(host.length - 9) == "vimeo.com" && ((path.substring(0, 11) == "/couchmode/" && path.search(/^\/couchmode.*\/([0-9]+)$/) != -1) || path.search(/^\/([0-9]+)/) != -1)) {
                    if (path.substring(0, 11) == "/couchmode/") {
                        this.ajax.vimeo(path.match(/^\/couchmode.*\/([0-9]+)$/)[1], contentWindow.location.href);
                    } else {
                        this.ajax.vimeo(path.match(/^\/([0-9]+)/)[1], contentWindow.location.href);
                    }
                    
                    /* OLD (broken CouchMode method)
                    var clipID = path.match(/^\/([0-9]+)/)[1];
                    var videoTitle = contentWindow.document.getElementById("header").getElementsByClassName("title")[0].textContent;
                    var videoAuthor = contentWindow.document.getElementById("header").getElementsByClassName("byline")[0].getElementsByTagName("a")[0].textContent;
                    if (mp4downloader.util.prefs.getBoolPref("hq")) {
                        this.saveVideo("http://vimeo.com/play_redirect?clip_id=" + clipID + "&quality=hd", contentWindow.location.href, videoTitle, videoAuthor, "Vimeo", true);
                    } else {
                        this.saveVideo("http://vimeo.com/play_redirect?clip_id=" + clipID + "&quality=sd", contentWindow.location.href, videoTitle, videoAuthor, "Vimeo", false);
                    }
                    */
                }
                
                /*
                // Google Video (video.google.com/videoplay)
                else if (host == "video.google.com" && path == "/videoplay") {
                    var docid = this.util.getFromString(query, "&docid=", "&");
                    if (hash.indexOf("docid") != -1) {
                        docid = this.util.getFromString(hash, "docid=", "&");
                    }
                    this.util.log("Google Video docid: " + docid);
                    this.ajax.googleVideo(docid);
                }
                
                // Google Video search page (video.google.com/videosearch)
                else if (host == "video.google.com" && path == "/videosearch") {
                    var thePlayers = contentWindow.document.getElementById("slideout-player").getElementsByClassName("iplay-title")[0].getElementsByTagName("a");
                    if (thePlayers.length >= 1) {
                        var thePlayerURL = thePlayers[0].getAttribute("href");
                        if (thePlayerURL.indexOf("/videoplay?") == 0 || thePlayerURL.indexOf("video.google.com") < 10) {
                            if (thePlayerURL.substring(0, 1) != "/") {
                                thePlayerURL = "http://video.google.com" + thePlayerURL;
                            }
                            this.ajax.googleVideo(this.util.getFromString(thePlayerURL, "docid=", "&"));
                        } else if (thePlayerURL.indexOf("youtube.com/watch") != -1 || thePlayerURL.indexOf("youtube-nocookie.com/watch") != -1) {
                            this.ajax.youtube(this.util.getFromString(thePlayerURL, "v=", "&"), contentWindow.location.href);
                        } else {
                            // We will need to localize this if we ever re-enable Google Video support
                            this.util.alert("Error: The video that is currently playing cannot be downloaded because it is not from the Google Video website.\nThis can occur when Google searches for videos outside of Google Video.");
                        }
                    } else {
                        // We will need to localize this if we ever re-enable Google Video support
                        this.util.alert("Error: MP4 Downloader cannot download this video!\nPlease report this error at http://mp4downloader.mozdev.org/contact\n\nDetails: thePlayers.length = " + thePlayers.length);
                    }
                }
                */
                
                // Facebook Video (facebook.com/video/video.php or facebook.com/photo.php?v=...)
                // TODO: Currently, Facebook Video support is broken. This is kept in hope that a Facebook change might bring back functionality; unlikely, though, based on their previous history of thwarting us with their constant changes.
                else if (host.substring(host.length - 12) == "facebook.com" && (hash.substring(0, 18) == "#!/video/video.php" || (hash.substring(0, 12) == "#!/photo.php" && ("&" + hash.substring(13)).indexOf("&v=") != -1) || (hash.substring(0, 2) != "#!" && (path.substring(0, 16) == "/video/video.php" || (path.substring(0, 10) == "/photo.php" && query.indexOf("&v=") != -1))))) {
                    var stages = contentWindow.document.getElementsByClassName("videoStage");
                    if (stages && stages.length > 0) {
                        var players = stages[0].getElementsByTagName("embed");
                        if (players && players.length > 0) {
                            var flashvars = players[0].getAttribute("flashvars");
                            
                            /* OLD
                            var videoTitle = this.util.trimString(contentWindow.document.getElementById("video_info").getElementsByClassName("video_title")[0].textContent);
                            if (videoTitle.substring(videoTitle.length - 4) == "[HQ]" || videoTitle.substring(videoTitle.length - 4) == "[HD]") {
                                videoTitle = this.util.trimString(videoTitle.substring(0, videoTitle.length - 4));
                            }
                            */
                            
                            // Should we only use highqual_src when the hq pref is set or if highqual_is_on==1? If so, we need to test it, finish it, and port it to ajax.facebook()
                            // (And, if we go through with this, we need to change all HQ prefs from "YouTube, Dailymotion, and Vimeo" to something that includes FB)
                            // NOTE: I guess we'll just wait until we update the HQ downloading system (and modularize site backends), then we can fix this.
                            var videoURL = this.util.getFromString(flashvars, "&highqual_src=", "&") ||
                                           this.util.getFromString(flashvars, "&lowqual_src=", "&") ||
                                           this.util.getFromString(flashvars, "&video_src=", "&");
                            
                            var videoTitle = this.util.getFromString(flashvars, "&video_title=", "&");
                            if (videoTitle) {
                                videoTitle = decodeURIComponent(videoTitle.replace(/\+/g, " "));
                                var videoAuthor = this.util.getFromString(flashvars, "&video_owner_name=", "&");
                                if (videoAuthor) {
                                    videoAuthor = decodeURIComponent(videoAuthor.replace(/\+/g, " "));
                                } else {
                                    videoAuthor = null;
                                }
                                if (videoURL) {
                                    this.saveVideo(decodeURIComponent(videoURL), contentWindow.location.href, videoTitle, videoAuthor, "Facebook", false);
                                    return;
                                }
                            }
                        }
                    }
                    
                    // If we're here, then no video was saved
                    var videoID = this.util.getFromString(hash, "?v=", "&") || this.util.getFromString(hash, "&v=", "&") || this.util.getFromString(contentWindow.location.href, "?v=", "&") || this.util.getFromString(contentWindow.location.href, "&v=", "&");
                    if (videoID) {
                        this.ajax.facebookVideo(this.util.getFromString(hash, "?v=", "&") || this.util.getFromString(hash, "&v=", "&") || this.util.getFromString(contentWindow.location.href, "?v=", "&") || this.util.getFromString(contentWindow.location.href, "&v=", "&"));
                    } else {
                        this.util.error(this.util.getString("mp4downloader", "error_noplay", ["Facebook"]), "Video URL: " + contentWindow.location.href);
                    }
                }
                
                // Not recognized
                else {
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
            } else {
                // Probably on about:blank (or something similar)
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
        
        var saveMode = mp4downloader.util.prefs.getIntPref("saveMode") || 0;
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
        
        if (mp4downloader.util.prefs.getCharPref("defaultFilename")) {
            videoTitle = this.util.parseString(mp4downloader.util.prefs.getCharPref("defaultFilename"), replaces);
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
        videoTitle = videoTitle.replace(illegalChars, mp4downloader.util.prefs.getCharPref("illegalCharReplacement"));
        
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
            if (mp4downloader.util.prefs.getBoolPref("dtaOneClick")) {
                if (window.DTA && (window.DTA.turboSendToDown || window.DTA.turboSendLinksToManager)) {
                    this.util.log("Using DTA 2.0 OneClick functions");
                    (window.DTA.turboSendToDown || window.DTA.turboSendLinksToManager)(window, [item]);
                } else {
                    this.util.log("Using legacy DTA OneClick functions");
                    window.DTA_AddingFunctions.turboSendToDown([item]);
                }
            } else {
                if (window.DTA && mp4downloader.util.prefs.getBoolPref("dtaAutoMask") && window.DTA.saveSingleItem) {
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
                var prefix = mp4downloader.util.prefs.getCharPref("saveLocation");
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
            
            if (mp4downloader.util.prefs.getBoolPref("savePrompt") && !mp4downloader.util.confirm(this.util.getString("mp4downloader", "prompt_useSaveDir", [videoTitle, dir.path]))) {
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
    
    
    /* AJAX FUNCTIONS */
    ajax: {
        // Download a video from YouTube based on its video ID (and optional referrer URL/eURL)
        youtube: function (videoID, eURL) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "https://www.youtube.com/get_video_info?video_id=" + videoID + (eURL ? "&eurl=" + encodeURIComponent(eURL) : ""), true);
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200 && Req.responseText) {
                        mp4downloader.util.log("YouTube AJAX received");
                        var flashvars = "&" + Req.responseText;
                        var videoTitle = mp4downloader.util.getString("mp4downloader", "sitevideo", ["YouTube"]);
                        if (flashvars.indexOf("&title=") != -1) {
                            videoTitle = decodeURIComponent(mp4downloader.util.getFromString(flashvars, "&title=", "&").replace(/\+/g, " "));
                        }
                        var videoAuthor = null;
                        if (flashvars.indexOf("&author=") != -1) {
                            videoAuthor = decodeURIComponent(mp4downloader.util.getFromString(flashvars, "&author=", "&").replace(/\+/g, " "));
                        }
                        if (flashvars.indexOf("&fmt_url_map=") != -1 || flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                            var fmt18url, fmt22url, fmt37url;
                            if (flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                                // Parse fmt_stream_map (kinda like fmt_url_map) - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                                let fmt_url_map = decodeURIComponent(mp4downloader.util.getFromString(flashvars, "&url_encoded_fmt_stream_map=", "&")).split(",");
                                for (let i = 0; i < fmt_url_map.length; i++) {
                                    let format, url, sig;
                                    let fmt_vars = fmt_url_map[i].split("&");
                                    for (let j = 0; j < fmt_vars.length; j++) {
                                        if (fmt_vars[j].substring(0, 4) == "itag") {
                                            format = fmt_vars[j].substring(5);
                                        } else if (fmt_vars[j].substring(0, 3) == "url") {
                                            url = decodeURIComponent(fmt_vars[j].substring(4));
                                        } else if (fmt_vars[j].substring(0, 3) == "sig") {
                                            sig = decodeURIComponent(fmt_vars[j].substring(4));
                                        }
                                    }
                                    url += "&signature=" + sig;
                                    if (format == "18") { // Normal quality
                                        fmt18url = url;
                                    }
                                    if (format == "22") { // 720p
                                        fmt22url = url;
                                    }
                                    if (format == "37") { // 1080p
                                        fmt37url = url;
                                    }
                                }
                            } else {
                                // Parse fmt_url_map (Format-URL Map) - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                                let fmt_url_map = decodeURIComponent(mp4downloader.util.getFromString(flashvars, "&fmt_url_map=", "&")).split(",");
                                for (let i = 0; i < fmt_url_map.length; i++) {
                                    let format = fmt_url_map[i].substring(0, 2);
                                    if (format == "18") { // Normal quality
                                        fmt18url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                    }
                                    if (format == "22") { // 720p
                                        fmt22url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                    }
                                    if (format == "37") { // 1080p
                                        fmt37url = fmt_url_map[i].substring(fmt_url_map[i].indexOf("|") + 1);
                                    }
                                }
                            }
                            
                            // Download HQ version if there is no standard-quality version
                            if ((mp4downloader.util.prefs.getBoolPref("hq") || !fmt18url) && (fmt22url || fmt37url)) {
                                if (fmt37url) {
                                    mp4downloader.util.log("YouTube format: 37 (1080p)");
                                    mp4downloader.saveVideo(fmt37url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", true);
                                } else if (fmt22url) {
                                    mp4downloader.util.log("YouTube format: 22 (720p)");
                                    mp4downloader.saveVideo(fmt22url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", true);
                                }
                            } else {
                                mp4downloader.util.log("YouTube format: 18 (normal quality)");
                                if (fmt18url) {
                                    mp4downloader.saveVideo(fmt18url, "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", false);
                                } else {
                                    // Fallback in case we cannot get a download URL from fmt_url_map
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_noMP4", ["YouTube"]));
                                }
                            }
                        } else {
                            /* OLD
                            var fmt = "18"; // Normal quality
                            if (flashvars.indexOf("&fmt_map=") != -1 && mp4downloader.util.prefs.getBoolPref("hq")) {
                                let fmt_map_tmp = mp4downloader.util.getFromString(flashvars, "&fmt_map=", "&");
                                fmt_map_tmp = decodeURIComponent(fmt_map_tmp).split(",");
                                let fmt_map = "";
                                for (let i = 0; i < fmt_map_tmp.length; i++) {
                                    fmt_map += fmt_map_tmp[i].split("/")[0] + ":";
                                }
                                if (fmt_map.indexOf("37:") != -1) {
                                    fmt = "37"; // 1080p
                                } else if (fmt_map.indexOf("22:") != -1) {
                                    fmt = "22"; // 720p
                                }
                                mp4downloader.util.log("YouTube format: " + fmt);
                            }
                            mp4downloader.saveVideo("http://www.youtube.com/get_video?video_id=" + videoID + "&t=" + mp4downloader.util.getFromString(flashvars, "&token=", "&") + "&fmt=" + fmt + "&el=detailpage&asv=", "http://www.youtube.com/watch?v=" + videoID, videoTitle, videoAuthor, "YouTube", ((fmt == "37" || fmt == "22") ? true : false));
                            */
                            if (flashvars.indexOf("status=fail") != -1) {
                                var code = flashvars.indexOf("&errorcode=") != -1 ? mp4downloader.util.getFromString(flashvars, "&errorcode=", "&") : "00";
                                var reason = flashvars.indexOf("&reason=") != -1 ? decodeURIComponent(mp4downloader.util.getFromString(flashvars, "&reason=", "&").replace(/\+/g, " ")) : "nothing";
                                if (reason.indexOf("<br") != -1) reason = reason.substring(0, reason.indexOf("<br"));
                                
                                // TODO: These tests don't work if the user's browser is in a different locale!
                                // (YouTube's error messages will be in a different language.)
                                // TODO: This will happen if we're on YouTube but they're using HTML5 (so we need to be able to get metadata from the HTML5 player)
                                if (reason.toLowerCase().indexOf("embedding disabled by request") == 0 || reason.toLowerCase().indexOf("it is restricted from playback on certain sites") != -1) {
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_noembed", ["YouTube"]));
                                } else if (reason.toLowerCase().indexOf("this video is not available in your country") == 0 || reason.toLowerCase().indexOf("the uploader has not made this video available in your country") == 0) {
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_blocked"));
                                } else if (reason.toLowerCase().indexOf("this video is private") == 0) {
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_private"));
                                } else if (reason.toLowerCase().indexOf("this video contains content from") == 0) {
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_copyright", ["YouTube", reason]));
                                } else {
                                    mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_youtube_getvideoinfo", [code, reason]), "videoID: " + videoID + (eURL ? "\neURL: " + eURL : ""));
                                }
                            } else {
                                mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_generic", ["ajax.youtube", "no format-url-stream map"]));
                            }
                        }
                    } else {
                        mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_ajax", ["YouTube", Req.status.toString()]), "videoID: " + videoID + (eURL ? "\neURL: " + eURL : ""));
                    }
                }
            };
            Req.send(null);
        },
        
        // Download a video from Dailymotion based on its videoID
        dailymotion: function (videoID) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "http://www.dailymotion.com/sequence/" + videoID, true);
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200 && Req.responseText) {
                        mp4downloader.util.log("Dailymotion AJAX received (sequence)");
                        
                        // We need to get the sequence, find all the strings we need, and put them into a simpler object
                        var sequence = mp4downloader.util.parseJSON(Req.responseText);
                        if (sequence) {
                            var vars = {};
                            var walker = function (obj) {
                                for (var prop in obj) {
                                    if (obj.hasOwnProperty(prop)) {
                                        if (typeof obj[prop] == "string" && !vars[prop]) {
                                            if (prop == "videoTitle" || prop == "videoOwnerLogin" || prop.substring(prop.length - 3) == "URL") {
                                                vars[prop] = obj[prop];
                                            }
                                        } else if (typeof obj[prop] == "object") {
                                            walker(obj[prop]);
                                        }
                                    }
                                }
                            };
                            walker(sequence);
                            
                            var videoTitle = vars["videoTitle"] || mp4downloader.util.getString("mp4downloader", "sitevideo", ["Dailymotion"]);
                            var videoAuthor = vars["videoOwnerLogin"] || null;
                            
                            var videoURLs = [];
                            if (vars["sdURL"] && vars["sdURL"].indexOf(".mp4") != -1) videoURLs.push(vars["sdURL"]);
                            if (vars["hqURL"] && vars["hqURL"].indexOf(".mp4") != -1) videoURLs.push(vars["hqURL"]);
                            if (vars["hdURL"] && vars["hdURL"].indexOf(".mp4") != -1) videoURLs.push(vars["hdURL"]);
                            if (vars["hd720URL"] && vars["hd720URL"].indexOf(".mp4") != -1) videoURLs.push(vars["hd720URL"]);
                            if (vars["hd1080URL"] && vars["hd1080URL"].indexOf(".mp4") != -1) videoURLs.push(vars["hd1080URL"]);
                            
                            if (videoURLs.length > 0) {
                                if (mp4downloader.util.prefs.getBoolPref("hq")) {
                                    // Get bottommost URL, which is the highest quality
                                    mp4downloader.saveVideo(videoURLs[videoURLs.length - 1], "http://www.dailymotion.com/video/" + videoID, videoTitle, videoAuthor, "Dailymotion", true);
                                    return;
                                } else {
                                    // Get topmost URL, which is the lowest quality
                                    mp4downloader.saveVideo(videoURLs[0], "http://www.dailymotion.com/video/" + videoID, videoTitle, videoAuthor, "Dailymotion", false);
                                    return;
                                }
                            }
                        } else {
                            mp4downloader.util.log("Couldn't parse sequence!");
                        }
                    } // (Req.status == 200 && Req.responseText)
                    
                    // If we're here, then no video was saved...
                    var Req2 = new XMLHttpRequest();
                    Req2.open("GET", "http://www.dailymotion.com/json/video/" + videoID + "?fields=stream_h264_url,title,url,owner_username", true);
                    //Req.open("GET", "http://www.dailymotion.com/json/video/" + videoID + "?fields=stream_h264_ld_url,title,url,owner_username", true);
                    Req2.onreadystatechange = function () {
                        if (Req2.readyState == 4) {
                            if (Req2.status == 200 && Req2.responseText) {
                                mp4downloader.util.log("Dailymotion AJAX received (stream_h264_url)");
                                var data = mp4downloader.util.parseJSON(Req2.responseText);
                                if (data && data.stream_h264_url) {
                                    mp4downloader.saveVideo(data.stream_h264_url, data.url || "http://www.dailymotion.com/video/" + videoID, data.title || (typeof videoTitle == "string" && videoTitle) || mp4downloader.util.getString("mp4downloader", "sitevideo", ["Dailymotion"]), data.owner_username || null, "Dailymotion", false);
                                    return;
                                } else {
                                    mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_noMP4", ["Dailymotion"]));
                                }
                            } else {
                                mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_ajax", ["Dailymotion", Req.status.toString() + "/" + Req2.status.toString()]), "videoID: " + videoID);
                            }
                        }
                    };
                    Req2.send(null);
                }
            };
            Req.send(null);
        },
        
        // Download a video from Vimeo based on its video ID (and optional referrer URL)
        vimeo: function (videoID, referURL) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "http://player.vimeo.com/config/" + videoID + (referURL ? "?referrer=" + encodeURIComponent(referURL) : ""), true);
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200 && Req.responseText) {
                        mp4downloader.util.log("Vimeo AJAX received");
                        var data = mp4downloader.util.parseJSON(Req.responseText);
                        if (data && data.request && data.video) {
                            // Make sure H264 version is available (some videos just have VP6 (flv container) or something else)
                            if (typeof data.video.files.h264 != "undefined") {
                                var videoTitle = data.video.title;
                                var videoAuthor = data.video.owner.name || null;
                                if (mp4downloader.util.prefs.getBoolPref("hq") && data.video.hd) {
                                    mp4downloader.saveVideo("http://" + data.request.player_url + "/play_redirect?quality=hd&codecs=h264&clip_id=" + data.video.id + "&time=" + data.request.timestamp + "&sig=" + data.request.signature + "&type=html5_desktop_embed", "http://vimeo.com/" + videoID, videoTitle, videoAuthor, "Vimeo", true);
                                } else {
                                    mp4downloader.saveVideo("http://" + data.request.player_url + "/play_redirect?quality=sd&codecs=h264&clip_id=" + data.video.id + "&time=" + data.request.timestamp + "&sig=" + data.request.signature + "&type=html5_desktop_embed", "http://vimeo.com/" + videoID, videoTitle, videoAuthor, "Vimeo", false);
                                }
                            } else {
                                mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_noMP4", ["Vimeo"]));
                            }
                        } else if (data && data.title && data.title == "Sorry") {
                            mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_vimeo", [data.message ? data.message.replace(/\\\//g, "/") : "nothing"]));
                        } else {
                            mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_generic", ["ajax.vimeo", "cannot get JSON data"]));
                        }
                    } else {
                        mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_ajax", ["Vimeo", Req.status.toString()]), "videoID: " + videoID + (referURL ? "\nRefer URL: " + referURL : ""));
                    }
                }
            };
            Req.send(null);
        },
        
        /*
        // Download a video from Google Video based on its docid
        googleVideo: function (docid) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "http://video.google.com/videoplay?docid=" + docid, true);
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200 && Req.responseText) {
                        mp4downloader.util.log("Google Video AJAX received");
                        var videoURL = mp4downloader.util.getFromString(Req.responseText, "If the download does not start automatically, right-click <a href=", ">");
                        if (videoURL) {
                            videoURL = videoURL.replace(/&amp;/g, "&");
                            var videoTitle = mp4downloader.util.getFromString(Req.responseText, "<title>", "</title>");
                            mp4downloader.saveVideo(videoURL, "http://video.google.com/videoplay?docid=" + docid, videoTitle, null, "Google Video", false);
                        } else {
                            // We will need to localize this if we ever re-enable Google Video support
                            //mp4downloader.util.alert("Error: MP4 Downloader cannot download the current video because it is not from the Google Video website.\nThis can occur when Google searches for videos outside of Google Video.");
                            mp4downloader.util.alert("Error: MP4 Downloader cannot download the current video because of a change in Google Video code that we do not yet have a fix for.");
                        }
                    } else {
                        mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_ajax", ["Google Video", Req.status.toString()]), "docid: " + docid);
                    }
                }
            };
            Req.send(null);
        },
        */
        
        // Download a video from Facebook Video based on its video ID
        // TODO: Currently, Facebook Video support is broken. This is kept in hope that a Facebook change might bring back functionality; unlikely, though, based on their previous history of thwarting us with their constant changes.
        facebookVideo: function (videoID) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "http://www.facebook.com/video/video.php?v=" + videoID, true);
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200 && Req.responseText) {
                        mp4downloader.util.log("Facebook Video AJAX received");
                        
                        function findVar(v) {
                            v = mp4downloader.util.getFromString(mp4downloader.util.getFromString(Req.responseText, '.addVariable("' + v + '",', '")'), '"') ||
                                mp4downloader.util.getFromString(mp4downloader.util.getFromString(Req.responseText, '["' + v + '",', '"]'), '"') ||
                                mp4downloader.util.getFromString(Req.responseText, "&" + v + "=", "&") ||
                                mp4downloader.util.getFromString(Req.responseText, "&amp;" + v + "=", "&");
                            if (v && typeof v == "string") {
                                return decodeURIComponent(v.replace(/\\u0025/g, "%").replace(/\+/g, " "));
                            }
                        }
                        
                        var videoTitle = findVar("video_title") || mp4downloader.util.getString("mp4downloader", "sitevideo", ["Facebook"]);
                        if (videoTitle.substring(videoTitle.length - 4) == "[HQ]" || videoTitle.substring(videoTitle.length - 4) == "[HD]") {
                            videoTitle = mp4downloader.util.trimString(videoTitle.substring(0, videoTitle.length - 4));
                        }
                        
                        var videoAuthor = findVar("video_owner_name");
                        
                        // Lots of fallbacks!
                        var videoURL = findVar("highqual_src") || findVar("lowqual_src") || findVar("video_src");
                        if (videoURL) {
                            mp4downloader.saveVideo(videoURL, "http://www.facebook.com/video/video.php?v=" + videoID, videoTitle, videoAuthor, "Facebook", false);
                        } else {
                            var temptitle = mp4downloader.util.getFromString(Req.responseText, "<title>", "</title>").toLowerCase();
                            if (temptitle.substring(0, 5) == "login" || temptitle.substring(0, 6) == "log in" || Req.responseText.indexOf("login.php") != -1) {
                                mp4downloader.util.alert(mp4downloader.util.getString("mp4downloader", "error_login", ["Facebook"]));
                            } else {
                                mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_noplay", ["Facebook"]), "Video ID: " + videoID);
                            }
                        }
                    } else {
                        mp4downloader.util.error(mp4downloader.util.getString("mp4downloader", "error_ajax", ["Facebook Video", Req.status.toString()]), "videoID: " + videoID);
                    }
                }
            };
            Req.send(null);
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
            if (mp4downloader.util.prefs.getBoolPref("contextmenu")) {
                var isVideoPage = false;
                // YouTube
                if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && (path == "/watch" || window.content.document.getElementById("channel-body") || (window.content.document.getElementById("page") && window.content.document.getElementById("page").className.indexOf("channel") != -1))) isVideoPage = true;
                
                // Dailymotion
                if (host.substring(host.length - 15) == "dailymotion.com" && path.substring(0, 6) == "/video") isVideoPage = true;
                
                // Vimeo
                // TODO: CouchMode
                if (host.substring(host.length - 9) == "vimeo.com" && path.search(/^\/([0-9]+)/) != -1) isVideoPage = true;
                
                /*
                // Google Video
                if (host.substring(host.length - 16) == "video.google.com" && (path == "/videosearch" || path == "/videoplay")) isVideoPage = true;
                */
                
                // Facebook Video
                if (host.substring(host.length - 12) == "facebook.com" && (hash.substring(0, 18) == "#!/video/video.php" || (hash.substring(0, 12) == "#!/photo.php" && ("&" + hash.substring(13)).indexOf("&v=") != -1) || (hash.substring(0, 2) != "#!" && (path.substring(0, 16) == "/video/video.php" || (path.substring(0, 10) == "/photo.php" && query.indexOf("&v=") != -1))))) isVideoPage = true;
                
                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", !isVideoPage);
            } else {
                document.getElementById("mp4downloader_contextmenu").setAttribute("hidden", true);
            }
            
            // Should we show context menu entry for video link?
            if (mp4downloader.util.prefs.getBoolPref("linkcontextmenu") && window.document && window.document.popupNode) {
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
                                (linkHost.substring(linkHost.length - 9) == "vimeo.com" && linkPath.match(/^\/([0-9]+)/)) ||
                                //(linkHost.substring(linkHost.length - 16) == "video.google.com" && linkPath.substring(0, 10) == "/videoplay") ||
                                // TODO: This could be a #! URL too... (maybe just wait until we modularize the site backends to implement a check for that... after we have some util to effectively create window.location objects)
                                (linkHost.substring(linkHost.length - 12) == "facebook.com" && (linkPath.substring(0, 16) == "/video/video.php" || (linkPath.substring(0, 10) == "/photo.php" && ("&" + linkPath.substring(11)).indexOf("&v=") != -1)))) {
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
        if (host.substring(host.length - 12) == "facebook.com" && path.indexOf("#!") != -1) {
            // Facebook - Trying to make life easier (well... speedier, but definitely not easier)
            path = this.util.getFromString(path, "#!");
        }
        
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
        
        /*
        // Google Video
        if (host.substring(host.length - 16) == "video.google.com" && path.substring(0, 10) == "/videoplay") {
            this.ajax.googleVideo(this.util.getFromString(pageURL, "#docid=", "&") || this.util.getFromString(pageURL, "?docid=", "&") || this.util.getFromString(pageURL, "&docid=", "&"));
        }
        */
        
        // Facebook Video
        // TODO: This could include a #! link (and also in the function above where we check the link - see the comment there)
        if (host.substring(host.length - 12) == "facebook.com" && (path.substring(0, 16) == "/video/video.php" || (path.substring(0, 10) == "/photo.php" && ("&" + path.substring(11)).indexOf("&v=") != -1))) {
            this.ajax.facebookVideo(this.util.getFromString(pageURL, "?v=", "&") || this.util.getFromString(pageURL, "&v=", "&"));
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
                        
                        /*
                        // Google Video
                        if ((contentHost.substring(contentHost.length - 16) != "video.google.com" || contentPath.substring(0, 6) != "/videoplay") && embedURLhost.substring(embedURLhost.length - 16) == "video.google.com") {
                            let clickFunc = {
                                ajaxFunc: this.ajax.googleVideo,
                                ajaxArgs: [
                                    this.util.getFromString(flashvars, "&docid=", "&")
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(objects[j], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        */
                        
                        // Facebook Video
                        if ((contentHost.substring(contentHost.length - 12) != "facebook.com" || (contentPath.substring(0, 16) != "/video/video.php" && contentPath.substring(0, 10) != "/photo.php")) && (embedURLhost.substring(embedURLhost.length - 12) == "facebook.com" || embedURLhost.substring(embedURLhost.length - 9) == "fbcdn.net")) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.facebookVideo,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, "/v/", "?") || this.util.getFromString(flashvars, "&v=", "&") || this.util.getFromString(flashvars, "&video_id=", "&")
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
                        
                        /*
                        // Google Video
                        if ((contentHost.substring(contentHost.length - 16) != "video.google.com" || contentPath.substring(0, 6) != "/videoplay") && embedURLhost.substring(embedURLhost.length - 16) == "video.google.com") {
                            let clickFunc = {
                                ajaxFunc: this.ajax.googleVideo,
                                ajaxArgs: [
                                    this.util.getFromString(flashvars, "&docid=", "&")
                                ]
                            };
                            if (noEmbed) {
                                return clickFunc;
                            } else {
                                this.embedDownloadButton(embeds[k], contentWindow, clickFunc);
                                foundVideos = true;
                            }
                        }
                        */
                        
                        // Facebook Video
                        if ((contentHost.substring(contentHost.length - 12) != "facebook.com" || (contentPath.substring(0, 16) != "/video/video.php" && contentPath.substring(0, 10) != "/photo.php")) && (embedURLhost.substring(embedURLhost.length - 12) == "facebook.com" || embedURLhost.substring(embedURLhost.length - 9) == "fbcdn.net")) {
                            let clickFunc = {
                                ajaxFunc: this.ajax.facebookVideo,
                                ajaxArgs: [
                                    this.util.getFromString(embedURLpath, "/v/", "?") || this.util.getFromString(flashvars, "&v=", "&") || this.util.getFromString(flashvars, "&video_id=", "&")
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
                    mp4downloader.util.log("No button container inside YouTube page");
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
                    dlBtn.setAttribute("title", mp4downloader.util.getString("mp4downloader", "downloadBtnLabel"));
                    dlBtn.appendChild(contentWindow.document.createTextNode(mp4downloader.util.getString("mp4downloader", "download")));
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
            /*
            // Google Video
            } else if (host.substring(host.length - 16) == "video.google.com" && path == "/videoplay") {
                let dlBtn = contentWindow.document.createElement("a");
                dlBtn.href = "javascript:void(0);";
                dlBtn.setAttribute("title", this.util.getString("mp4downloader", "downloadBtnLabel"));
                dlBtn.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "downloadBtnLabel")));
                dlBtn.addEventListener("click", function () {
                    mp4downloader.mp4download(null, contentWindow);
                }, false);
                let dlSpan = contentWindow.document.createElement("span");
                dlSpan.appendChild(dlBtn);
                let dlHost = contentWindow.document.createElement("div");
                dlHost.className = "control";
                dlHost.appendChild(dlSpan);
                contentWindow.document.getElementById("metadata-control").insertBefore(dlHost, contentWindow.document.getElementById("report-control"));
            */
            // Facebook Video
            // TODO: Currently, Facebook Video support is broken. This is kept in hope that a Facebook change might bring back functionality; unlikely, though, based on their previous history of thwarting us with their constant changes.
            } else if (host.substring(host.length - 12) == "facebook.com" && (hash.substring(0, 18) == "#!/video/video.php" || (hash.substring(0, 12) == "#!/photo.php" && ("&" + hash.substring(13)).indexOf("&v=") != -1) || (hash.substring(0, 2) != "#!" && (path.substring(0, 16) == "/video/video.php" || (path.substring(0, 10) == "/photo.php" && query.indexOf("&v=") != -1))))) {
                //if (contentWindow.document.getElementById("video_actions")) {
                if (contentWindow.document.getElementById("fbPhotoPageActions")) {
                    let dlBtn = contentWindow.document.createElement("a");
                    dlBtn.className = "fbPhotosPhotoActionsItem";
                    dlBtn.href = "javascript:void(0);";
                    //dlBtn.setAttribute("title", this.util.getString("mp4downloader", "downloadBtnLabel"));
                    dlBtn.appendChild(contentWindow.document.createTextNode(this.util.getString("mp4downloader", "downloadBtnLabel")));
                    dlBtn.addEventListener("click", function () {
                        mp4downloader.mp4download(null, contentWindow);
                    }, false);
                    let insertBase = contentWindow.document.getElementById("fbPhotoPageActions");
                    let insertBefore = null;
                    for (var i = 0; i < insertBase.childNodes.length; i++) {
                        if (insertBase.childNodes[i] && insertBase.childNodes[i].nodeName && insertBase.childNodes[i].nodeName.toLowerCase()  != "a") {
                            insertBefore = insertBase.childNodes[i];
                            break;
                        }
                    }
                    if (insertBefore) {
                        insertBase.insertBefore(dlBtn, insertBefore);
                    } else {
                        insertBase.appendChild(dlBtn);
                    }
                } else {
                    return "retry";
                }
            }
        } catch (err) {
            mp4downloader.util.log("embedBtnOnVideo Error: " + err + "\nLine: " + err.lineNumber);
        }
    }
};


// Listener to run all onload functions
window.addEventListener("load", function () {
    // TODO: Would it be a good idea to do `removeEventListener("load", arguments.callee, false)` or would that just be a waste?
    
    // Import util functions
    Components.utils.import("resource://mp4downloader/util.jsm", mp4downloader);
    
    // Set event listener to show/hide context menu items
    document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", function () {
        mp4downloader.checkContextMenu();
    }, false);
    
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
            if (mp4downloader.util.prefs.getBoolPref("embedBtn")) {
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
            if (mp4downloader.util.prefs.getBoolPref("embedBtnOnVideo")) {
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
    
    // Migrate prefs and add toolbar button if this is the first time
    var isFirstTime = false;
    if (!mp4downloader.util.prefs.getBoolPref("firstRunComplete")) {
        // Set var for below
        isFirstTime = true;
        Components.utils.import("resource://mp4downloader/firstrun.jsm", mp4downloader);
        mp4downloader.firstrun.migrateOldPrefs();
        if (mp4downloader.firstrun.addToolbarButton(document)) {
            mp4downloader.util.prefs.setBoolPref("firstRunComplete", true);
        }
    }
    
    setTimeout(function () {
        mp4downloader.util.getVersion(function (currentVersion) {
            if (isFirstTime || mp4downloader.util.prefs.getCharPref("lastVersion") != currentVersion) {
                mp4downloader.util.prefs.setCharPref("lastVersion", currentVersion);
                if (!mp4downloader.firstrun) Components.utils.import("resource://mp4downloader/firstrun.jsm", mp4downloader);
                mp4downloader.firstrun.migratePrefs();
                mp4downloader.firstrun.openFirstrunPage(currentVersion, gBrowser, isFirstTime);
            }
        });
    }, 100);
}, false);