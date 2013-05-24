/*
    MP4 Downloader Bookmarklet
    Copyright (C) 2013 Jake Hartz
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/* CONFIG OPTIONS:
To specify config options, use (or create) a global var called mp4downloader_BOOKMARKLET_CONFIG before inporting this file.
Note that everything is case-sensitive.

Defaults:
mp4downloader_BOOKMARKLET_CONFIG = {
    useHQ: false,     // Always download HQ videos when possible (takes priority over noHQ)
    noHQ: false,      // Never download HQ videos
}

In regards to HQ videos, if "useHQ" is set to "true", HQ videos will always be downloaded whenever possible. If "useHQ" is not set to "true" and "noHQ" is set to "true", HQ videos will NEVER be downloaded. If neither are set to "true", HQ videos will be downloaded if "&hd=1" is added to the YouTube URL (this causes YouTube to play it in HD by default).

You can also specify options in the URL of the page the bookmarklet was added to. (This is also case-sensitive.)
Ex: http://www.youtube.com/watch?v=...&mp4downloader_bookmarklet_useHQ=1

Note that config options can only be granted, not taken away.
For example, you can change something to "true" in the global JS var, but you can't later set it to false using a URL param (it will still be true due to the param in the global JS var).
*/

(function () {
    // Wrap everything in a try/catch (just to make sure we don't break other scripts if this one fails)
    try {
        // Some shortcuts (for better minification)
        var CONTACT_URL = "http://mp4downloader.mozdev.org/contact",
            pre = "mp4downloader_BOOKMARKLET_",
            urlpre = pre.toLowerCase(),
            dompre = pre.substring(0, pre.length - 1),
            config = pre + "CONFIG",
            d = decodeURIComponent,
            e = encodeURIComponent;
        
        // Make sure config is set
        if (!window[config]) {
            window[config] = {};
        }
        
        /*
        // Traverse frames - not currently enabled...
        // If a video is found in a frame, the frame's container still opens the "no videos found" message...
        // so if we can't find a video, instead of showing the message just do this (for framesets, not iframes)
        // maybe for iframes we can try and establish some sort of "channel" or something (and for framesets, too) to determine whether the message should be shown or not (or, in the case of framesets, which frame is showing the message - maybe just pick the biggest?)
        try {
            for (var index = 0; index < window.frames.length; index++) {
                try {
                    var frame = window.frames[index];
                    // This is (almost) the same as the code in the bookmarklet
                    // TODO: Sync this up with the newest bookmarklet code
                    if (frame[pre + "SCRIPT"]) {
                        frame[pre + "SCRIPT"].parentNode && frame[pre + "SCRIPT"].parentNode.removeChild(frame[pre + "SCRIPT"]);
                    }
                    frame[config] = window[config];
                    frame[pre + "SCRIPT"] = frame.document.createElement("script");
                    frame[pre + "SCRIPT"].id = dompre + "SCRIPT";
                    frame[pre + "SCRIPT"].type = "text/javascript";
                    frame[pre + "SCRIPT"].src = "http://mp4downloader.mozdev.org/bookmarklet-min.js";
                    (frame.document.getElementsByTagName("head")[0] || frame.document.getElementsByTagName("body")[0] || frame.document.body).appendChild(frame[pre + "SCRIPT"]);
                } catch (err) {
                    // Most likely a permission problem...
                }
            }
        } catch (err) {
            // Most likely a permission problem or window.frames problem in browser
        }
        */
        
        // Location vars
        var host;
        try {
            host = window.location.hostname;
            if (!host) throw "nohost"; // Use alternate method
        } catch (err) {
            // Sometimes, hostname triggers an error for some browsers
            // so we have this backup
            host = window.location.href;
            // Get rid of protocol
            if (host.indexOf(":") != -1) {
                host = host.substring(host.indexOf(":") + 1);
                while (host.indexOf("/") == 0) {
                    host = host.substring(1);
                }
            }
            // Get rid of path
            if (host.indexOf("/") != -1) {
                host = host.substring(0, host.indexOf("/"));
            }
        }
        var path = window.location.pathname;
        var query = (window.location.search ? "&" + window.location.search.substring(1) : "");
        
        // Util functions
        var getFromString = function (theString, beginStr, endStr) {
            if (theString && beginStr && theString.indexOf(beginStr) != -1) {
                var fixedString = theString.substring(theString.indexOf(beginStr) + beginStr.length);
                if (endStr && fixedString.indexOf(endStr) != -1) {
                    fixedString = fixedString.substring(0, fixedString.indexOf(endStr));
                }
                return fixedString;
            } else {
                return false;
            }
        };
        
        var error = function (msg, details) {
            alert("MP4 Downloader Error: " + msg + "\nPlease report this error at " + CONTACT_URL + (details ? " and include the video you were on and these details:\n\n" + details : ""));
        };
        
        // Test for HQ
        var pref_hq = false;
        // If a pref is enabled to always use HQ when possible
        if (window[config].useHQ || getFromString(query, "&" + urlpre + "useHQ=", "&") || getFromString(query, "&" + urlpre + "useHD=", "&")) {
            pref_hq = true;
        // If the video is playing in HQ and no pref is enabled to never use HQ
        } else if (!getFromString(query, "&" + urlpre + "noHQ=", "&") && !window[config].noHQ && (getFromString(query, "&hd=", "&") == "1" || getFromString(query, "&fmt=", "&") == "22" || getFromString(query, "&fmt=", "&") == "37")) {
            pref_hq = true;
        }
        
        // Function to download video from YouTube based on videoID
        var youtubeAjax = function (videoID, videoTitle) {
            var Req = new XMLHttpRequest();
            Req.open("GET", "http://www.youtube" + (host.indexOf("nocookie") != -1 ? "-nocookie" : "") + ".com/get_video_info?video_id=" + videoID +  "&eurl=" + e(window.location.href), true);
            /*
            try {
                Req.setRequestHeader("User-Agent", navigator.userAgent || "Mozilla/5.0");
            } catch (err) {}
            */
            Req.onreadystatechange = function () {
                if (Req.readyState == 4) {
                    if (Req.status == 200) {
                        try {
                            var res = Req.responseText;
                            if (res.indexOf("&title=") != -1) {
                                videoTitle = d(getFromString(res, "&title=", "&"));
                                if (videoTitle.indexOf("+") != -1) {
                                    videoTitle = videoTitle.replace(/\+/g, " ");
                                }
                            }
                            if (res.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                                var fmt18url, fmt22url, fmt37url;
                                // Parse Format-URL Map - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                                var fmt_url_map = d(getFromString(res, "&url_encoded_fmt_stream_map=", "&")).split(",");
                                for (var i = 0; i < fmt_url_map.length; i++) {
                                    var format, url, sig;
                                    var fmt_vars = fmt_url_map[i].split("&");
                                    for (var j = 0; j < fmt_vars.length; j++) {
                                        if (fmt_vars[j].substring(0, 4) == "itag") {
                                            format = fmt_vars[j].substring(5);
                                        } else if (fmt_vars[j].substring(0, 3) == "url") {
                                            url = d(fmt_vars[j].substring(4));
                                        } else if (fmt_vars[j].substring(0, 3) == "sig") {
                                            sig = d(fmt_vars[j].substring(4));
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
                                // Download HQ version if there is no standard-quality version
                                if ((pref_hq || !fmt18url) && (fmt22url || fmt37url)) {
                                    if (fmt37url) {
                                        location.href = fmt37url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                                    } else if (fmt22url) {
                                        location.href = fmt22url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                                    } else {
                                        error("There was a problem downloading the high quality video.", "Cannot find fmt37url or fmt22url even though they exist in mapping.");
                                    }
                                } else {
                                    if (fmt18url) {
                                        location.href = fmt18url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                                    } else {
                                        // Fallback in case we cannot get a download URL from fmt_url_map
                                        error("MP4 Downloader cannot download this video!", "bookmarklet: \"no MP4 format inside the format-url map\"");
                                    }
                                }
                            } else {
                                if (res.indexOf("status=fail") != -1) {
                                    error("MP4 Downloader cannot download this video due to a YouTube get_video_info error!" + (res.indexOf("&reason=") != -1 ? "\nYouTube responded with" + (res.indexOf("&errorcode=") != -1 ? " error " + getFromString(res, "&errorcode=", "&") : "") + ": \"" + d(getFromString(res, "&reason=", "&").replace(/\+/g, " ")) + "\"" : ""));
                                } else {
                                    error("MP4 Downloader cannot download video!", "bookmarklet: \"no format-url map\"");
                                }
                            }
                        } catch (err) {
                            error("There was a problem during the AJAX request.", err);
                        }
                    }
                }
            };
            Req.send();
        }
        
        // "The meat" of the bookmarklet
        if ((host.substring(host.length - 11) == "youtube.com" || host.substring(host.length - 20) == "youtube-nocookie.com") && (path == "/watch" || document.getElementById("channel-body"))) {
            var videoID = getFromString(query, "&v=", "&");
            var videoTitle;
            if (document.getElementById("channel-body")) {
                videoTitle = (document.getElementById("playnav-curvideo-title").textContent || document.getElementById("playnav-curvideo-title").innerText).replace(/^\s\s*/, "").replace(/\s\s*$/, "");
            } else if (document.title.lastIndexOf(" - YouTube") == document.title.length - 10) {
                videoTitle = document.title.substring(0, document.title.length - 10);
            } else if (document.title.indexOf("YouTube - ") == 0) {
                videoTitle = document.title.substring(10);
            } else {
                videoTitle = document.title;
            }
            if (document.getElementById("movie_player")) {
                var flashvars = document.getElementById("movie_player").getAttribute("flashvars");
                if (!flashvars) {
                    // Try getting flashvars as if movie_player is an <object>
                    try {
                        flashvars = document.getElementById("movie_player").getElementsByName("flashvars")[0].getAttribute("value");
                    } catch (err) {}
                }
                videoID = getFromString(flashvars, "&video_id=", "&") || videoID;
                if (flashvars && flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
                    var fmt18url, fmt22url, fmt37url;
                    // Parse Format-URL Map - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
                    var fmt_url_map = d(getFromString(flashvars, "&url_encoded_fmt_stream_map=", "&")).split(",");
                    for (var i = 0; i < fmt_url_map.length; i++) {
                        var format, url, sig;
                        var fmt_vars = fmt_url_map[i].split("&");
                        for (var j = 0; j < fmt_vars.length; j++) {
                            if (fmt_vars[j].substring(0, 4) == "itag") {
                                format = fmt_vars[j].substring(5);
                            } else if (fmt_vars[j].substring(0, 3) == "url") {
                                url = d(fmt_vars[j].substring(4));
                            } else if (fmt_vars[j].substring(0, 3) == "sig") {
                                sig = d(fmt_vars[j].substring(4));
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
                    if ((pref_hq || !fmt18url) && (fmt22url || fmt37url)) {
                        if (fmt37url) {
                            location.href = fmt37url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                        } else if (fmt22url) {
                            location.href = fmt22url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                        } else {
                            error("There was a problem downloading the high quality video.", "Cannot find fmt37url or fmt22url even though they exist inside mapping.");
                        }
                    } else {
                        if (fmt18url) {
                            location.href = fmt18url + "&title=" + e(videoTitle.replace(/\//g, "-"));
                        } else {
                            youtubeAjax(videoID, videoTitle);
                        }
                    }
                } else {
                    youtubeAjax(videoID, videoTitle);
                }
            } else {
                // Last resort
                if (videoID) {
                    youtubeAjax(videoID, videoTitle);
                } else {
                    if (document.documentElement.innerHTML.indexOf("&video_id=") != -1) {
                        youtubeAjax(getFromString(document.documentElement.innerHTML, "&video_id=", "&"), videoTitle);
                    } else if (document.documentElement.innerHTML.indexOf('"video_id": "') != -1) {
                        youtubeAjax(getFromString(document.documentElement.innerHTML, '"video_id": "', '"'), videoTitle);
                    } else {
                        // Search for tags with the name "video_id" (very last resort)
                        var namedTags = document.getElementsByName("video_id");
                        var videoID;
                        if (namedTags.length > 0) {
                            for (var i = 0; i < namedTags.length; i++) {
                                if (namedTags[i].getAttribute("value")) {
                                    videoID = namedTags[i].getAttribute("value");
                                    break;
                                }
                            }
                        }
                        if (videoID) {
                            youtubeAjax(videoID, videoTitle);
                        } else {
                            // If we get here, no hope is left
                            alert("MP4 Downloader cannot download this video! Please try again and make sure that the video can play on YouTube.\n\nIf this error continues, please contact us at " + CONTACT_URL + " and specify that \"movie_player\" was not found and no workaround was successful.");
                        }
                    }
                }
            }
        /*
        } else if (host == "video.google.com" && path == "/videoplay") {
            location.href = document.getElementById("download-instructions-detail").innerHTML.split(unescape("right-click%20%3Ca%20href%3D%22"))[1].split(unescape("%22%3Ethis%20link"))[0].replace(/&amp;/g, "&");
        */
        } else {
            alert("This page does not contain a supported video. Please try downloading from YouTube.\n\nIf you have problems, contact us at " + CONTACT_URL);
        }
    } catch (err) {
        error("Global Error", err);
    }
})();