/*
    Copyright (C) 2016  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var EXPORTED_SYMBOLS = ["youtube"];

var mp4downloader = {};
Components.utils.import("resource://mp4downloader/utils.jsm", mp4downloader);


/* MP4 DOWNLOADER API */

var youtube = {
    getFormatsByWindow: function (contentWindow) {
        return new Promise(function (resolve, reject) {
            var flashvars;
            if (isVideoPage(contentWindow) && (flashvars = findFlashvars(contentWindow))) {
                resolve(getStreamMap(flashvars));
            }
            resolve(false);
        });
    },
    
    getFormatsById: function (videoID, referrer) {
        return getFlashvars(videoID, referrer).then(function (flashvars) {
            return getStreamMap(flashvars);
        });
    },
    
    getIdFromLink: function (url) {
        return Promise.reject("Unimplemented");
    },
    
    downloadVideoByWindow: function (contentWindow, quality) {
        return Promise.reject("Unimplemented");
    },
    
    downloadVideoById: function (videoID, referrer, quality) {
        return Promise.reject("Unimplemented");
    },
    
    detectEmbeddedVideos: function (contentWindow) {
        return Promise.reject("Unimplemented");
    }
};


/* YOUTUBE-SPECIFIC FUNCTIONS */

function isVideoPage(contentWindow) {
    var url = mp4downloader.utils.getURLParts(contentWindow.location);
    return !!(
        (
            url.host.substring(url.host.length - 11) == "youtube.com" ||
            url.host.substring(url.host.length - 20) == "youtube-nocookie.com"
        ) &&
        (
            url.path == "/watch" ||
            contentWindow.document.getElementById("channel-body") ||
            (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1)
        )
    );
}


// Get formats or URLs from the fmt_stream_map in the flashvars
function getStreamMap(flashvars, returnUrls) {
    var urlsByFormat = {}, empty = true;
    if (flashvars.indexOf("&url_encoded_fmt_stream_map=") != -1) {
        // Parse fmt_stream_map - http://en.wikipedia.org/wiki/YouTube#Quality_and_codecs
        var fmt_url_map = decodeURIComponent(mp4downloader.utils.getFromString(flashvars, "&url_encoded_fmt_stream_map=", "&")).split(",");
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
            urlsByFormat[format] = url;
            empty = false;
        }
    }
    
    if (empty) {
        return false;
    } else if (returnUrls) {
        return urlsByFormat;
    } else {
        var formats = [];
        // Go in order, highest quality to lowest
        if (urlsByFormat["37"]) formats.push({name: "1080p", quality: "37"});
        if (urlsByFormat["22"]) formats.push({name: "720p", quality: "22"});
        if (urlsByFormat["18"]) formats.push({name: "Normal", quality: "18"});
        return formats;
    }
}


// Find flashvars inside contentWindow (should already be checked by isVideoPage)
function findFlashvars(contentWindow) {
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
                mp4downloader.utils.log("Using yt.config to find flashvars");
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
                    flashvars = mp4downloader.utils.getFromString(allBody, 'flashvars="', '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                } else if (flashvarsCount > 1) {
                    // Try to find the movie player
                    while (allBody.indexOf('flashvars="') != -1) {
                        allBody = mp4downloader.utils.getFromString(allBody, 'flashvars="');
                        var tempFlashvars = mp4downloader.utils.getFromString(allBody, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                        allBody = mp4downloader.utils.getFromString(allBody, '"');
                        
                        if (tempFlashvars.indexOf("&video_id=") != -1) {
                            // Let's assume this is it (but still go through the rest in case we find a better cantidate)
                            flashvars = tempFlashvars;
                        }
                    }
                }
            } catch (err) {}
        }
    }
    
    if (flashvars) {
        // Makes it easier to find stuff in here later on
        return "&" + flashvars;
    } else {
        return false;
    }
}


// Find video ID, title, author from flashvars with fallbacks for contentWindow (should already be checked by isVideoPage)
function findVideoMetadata(flashvars, contentWindow) {
    flashvars = flashvars || findFlashvars(contentWindow);
    var url;
    if (contentWindow && contentWindow.location) url = mp4downloader.utils.getURLParts(contentWindow.location);
    
    // Try and get Video ID
    var videoID;
    if (flashvars && flashvars.indexOf("&video_id=") != -1) {
        videoID = mp4downloader.utils.getFromString(flashvars, "&video_id=", "&");
    } else if (contentWindow) {
        if (url.query && url.query.v) {
            videoID = url.query.v;
        } else if (contentWindow.document.documentElement.innerHTML.indexOf("&video_id=") != -1) {
            videoID = mp4downloader.utils.getFromString(contentWindow.document.documentElement.innerHTML, "&video_id=", "&");
        } else if (contentWindow.document.documentElement.innerHTML.indexOf('"video_id": "') != -1) {
            videoID = mp4downloader.utils.getFromString(contentWindow.document.documentElement.innerHTML, '"video_id": "', '"');
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
    }
    
    var videoTitle = mp4downloader.utils.getString("mp4downloader", "sitevideo", ["YouTube"]);
    if (flashvars && flashvars.indexOf("&title=") != -1) {
        videoTitle = decodeURIComponent(mp4downloader.utils.getFromString(flashvars, "&title=", "&").replace(/\+/g, " "));
    } else if (contentWindow) {
        if (contentWindow.document.getElementById("channel-body") || (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1)) {
            if (contentWindow.document.getElementById("playnav-curvideo-title")) {
                videoTitle = mp4downloader.utils.trimString(contentWindow.document.getElementById("playnav-curvideo-title").textContent);
            } else if (contentWindow.document.getElementsByClassName("channels-featured-video-details").length > 0 || contentWindow.document.getElementsByClassName("video-detail").length > 0) {
                let dets = contentWindow.document.getElementsByClassName("channels-featured-video-details");
                if (dets.length == 0) dets = contentWindow.document.getElementsByClassName("video-detail");
                for (var i = 0; i < dets.length; i++) {
                    if (dets[i].getElementsByClassName("title").length > 0) {
                        videoTitle = mp4downloader.utils.trimString(dets[i].getElementsByClassName("title")[0].getElementsByTagName("a")[0].textContent);
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
    }
    
    var videoAuthor;
    if (flashvars && flashvars.indexOf("&author=") != -1) {
        videoAuthor = decodeURIComponent(mp4downloader.utils.getFromString(flashvars, "&author=", "&"));
    } else if (contentWindow) {
        if (contentWindow.document.getElementById("watch-username")) {
            videoAuthor = mp4downloader.utils.trimString(contentWindow.document.getElementById("watch-username").textContent);
        } else if (contentWindow.document.getElementById("un")) {
            // Feather
            videoAuthor = mp4downloader.utils.trimString(contentWindow.document.getElementById("un").textContent);
        } else if (contentWindow.document.getElementById("watch-uploader-info") && contentWindow.document.getElementById("watch-uploader-info").getElementsByClassName("author").length > 0) {
            videoAuthor = mp4downloader.utils.trimString(contentWindow.document.getElementById("watch-uploader-info").getElementsByClassName("author")[0].textContent);
        } else if (contentWindow.document.getElementById("de") && contentWindow.document.getElementById("de").getElementsByClassName("author").length > 0) {
            // Feather
            videoAuthor = mp4downloader.utils.trimString(contentWindow.document.getElementById("de").getElementsByClassName("author")[0].textContent);
        }
    }
    
    return {
        videoID: videoID,
        title: videoTitle,
        author: videoAuthor
    };
}


// Get flashvars by video ID (AJAX)
function getFlashvars(videoID, referrer) {
    return new Promise(function (resolve, reject) {
        var Req = mp4downloader.utils.getXMLHttpRequest();
        Req.open("GET", "https://www.youtube.com/get_video_info?video_id=" + videoID + (referrer ? "&eurl=" + encodeURIComponent(referrer) : ""), true);
        Req.onreadystatechange = function () {
            if (Req.readyState == 4) {
                if (Req.status == 200 && Req.responseText) {
                    mp4downloader.utils.log("YouTube AJAX received");
                    var flashvars = "&" + Req.responseText;
                    resolve(flashvars);
                } else {
                    reject([
                        mp4downloader.utils.getString("mp4downloader", "error_ajax", ["YouTube", Req.status.toString()]),
                        "videoID: " + videoID + (referrer ? "\neURL: " + referrer : "")
                    ]);
                }
            }
        };
        Req.send(null);
    });
}
