/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 */

// See: https://github.com/jhartz/mp4downloader/wiki/Video-Site-Module

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["youtube"];

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");


// Highest quality to lowest quality
// https://en.wikipedia.org/wiki/YouTube#Quality_and_formats
const YT_FORMATS = [
    {
        format: "38",
        name: "3072p"
    },
    {
        format: "85",
        name: "1080p 3D"
    },
    {
        format: "37",
        name: "1080p"
    },
    {
        format: "84",
        name: "720p 3D"
    },
    {
        format: "22",
        name: "720p"
    },
    {
        format: "82",
        name: "360p 3D"
    },
    {
        format: "18",
        name: "360p"
    },
    {
        format: "83",
        name: "240p 3D"
    }
];

var formatNames = {};
YT_FORMATS.forEach(function ({format, name}) {
    formatNames[format] = name;
});


/* MP4 DOWNLOADER API */

var youtube = {
    testWindow: function (contentWindow) {
        let url = mpUtils.getURLParts(contentWindow.location);
        if (url.domain != "youtube.com" &&
            url.domain != "youtube-nocookie.com") return false;
        return !!(
            url.path == "/watch" ||
            contentWindow.document.getElementById("channel-body") ||
            (contentWindow.document.getElementById("page") && contentWindow.document.getElementById("page").className.indexOf("channel") != -1)
        );
    },
    
    injectDownloadButton: function (contentWindow, callback) {
        let dlBtn = contentWindow.document.createElement("button");
        dlBtn.addEventListener("click", callback, false);
        if (contentWindow.document.getElementById("watch-headline-title")) {
            // Normal YouTube page
            dlBtn.className = "yt-uix-button yt-uix-button-text yt-uix-button-size-default yt-uix-tooltip yt-uix-tooltip-reverse";
            dlBtn.style.cssFloat = "right";
            dlBtn.setAttribute("title", mpUtils.getString("mp4downloader", "downloadBtnLabel"));
            dlBtn.setAttribute("type", "button");
            dlBtn.appendChild(contentWindow.document.createTextNode(mpUtils.getString("mp4downloader", "download")));
            let h1 = contentWindow.document.getElementById("watch-headline-title");
            h1.insertBefore(dlBtn, h1.firstChild);
            if (h1.parentNode.className.indexOf("yt-uix-expander-collapsed") != -1) {
                let index = h1.parentNode.className.indexOf("yt-uix-expander-collapsed");
                let before = h1.parentNode.className.substring(0, index);
                let after = h1.parentNode.className.substring(index + "yt-uix-expander-collapsed".length);
                h1.parentNode.className = before + " " + after;
            }
        } else {
            // No clue...
            // NOTE: We're only logging this (not showing it to user) because it can occur when a subframe on a YT page doesn't have a real URL (it seems to inherit its parent's), and there is definitely no button container inside the iframe
            mpUtils.log("No button container inside YouTube page");
        }
    },
    
    getFormatsByWindow: function (contentWindow) {
        return getDataFromWindow(contentWindow).then(function ({formats}) {
            return formats;
        });
    },
    
    getFormatsById: function (videoID, referrer) {
        return getDataFromId(videoID, referrer).then(function ({formats}) {
            return formats;
        });
    },
    
    getIdFromLink: function (url) {
        url = mpUtils.getURLParts(url);
        if (url.domain != "youtube.com" &&
            url.domain != "youtube-nocookie.com") return null;
        if (url.path != "/watch") return null;
        return url.query.v || null;
    },
    
    downloadVideoByWindow: function (contentWindow, format) {
        return getDataFromWindow(contentWindow).then(function ({formats, urlsByFormat, author, title}) {
            if (!urlsByFormat[format]) return Promise.reject(mpUtils.createSiteError("TODO: Error Message... missing format..."));
            
            return {
                url: urlsByFormat[format],
                referrer: contentWindow.location.href,
                title: title,
                author: author,
                site: "YouTube",
                quality: formatNames[format]
            };
        });
    },
    
    downloadVideoById: function (videoID, referrer, format) {
        return getDataFromId(videoID, referrer).then(function ({formats, urlsByFormat, author, title}) {
            if (!urlsByFormat[format]) return Promise.reject(mpUtils.createSiteError("TODO: Error Message... missing format..."));
            
            return {
                url: urlsByFormat[format],
                referrer: referrer,
                title: title,
                author: author,
                site: "YouTube",
                quality: formatNames[format]
            };
        });
    },
    
    detectEmbeddedVideos: function (contentWindow) {
        return Promise.reject("TODO: Unimplemented");
    }
};


/* YOUTUBE-SPECIFIC FUNCTIONS */

/**
 * Parse a YouTube stream map.
 *
 * @param {string} map - A string representing a YouTube
 *        url_encoded_fmt_stream_map.
 *
 * @return {Object} A mapping of format IDs to URLs.
 */
function parseStreamMap(map) {
    let urlsByFormat = {};
    if (map) {
        map.split(",").map(function (queryString) {
            return mpUtils.parseQuery(queryString);
        }).forEach(function (query) {
            urlsByFormat[query.itag] = query.url + "&signature=" + query.sig;
        });
    }
    return urlsByFormat;
}

/**
 * Get data (formats, URLs, video title, author, etc.) from the flashvars.
 *
 * @param {Object|string} flashvars - The "flashvars" for a YouTube video,
 *        either as an object or a url-encoded query string.
 *
 * @return {Promise.<Object>} Data from the flashvars
 *         ("formats", "urlsByFormat", "author", "title")
 */
function parseFlashvars(flashvars) {
    if (typeof flashvars == "string") flashvars = mpUtils.parseQuery(flashvars);
    let urlsByFormat = parseStreamMap(flashvars.url_encoded_fmt_stream_map);
    if (Object.keys(urlsByFormat).length > 0) {
        return Promise.resolve({
            formats: YT_FORMATS.filter(function ({format}) {
                return !!urlsByFormat[format];
            }),
            urlsByFormat: urlsByFormat,
            author: flashvars.author,
            title: flashvars.title
        });
    }
    
    return Promise.reject(createFlashvarsError(flashvars));
}

/**
 * Find flashvars inside contentWindow and parse the data from them.
 * (contentWindow should already be checked by isVideoPage)
 *
 * @return {Promise.<Object>} Data about the video (see parseFlashvars return
 *         value).
 */
function getDataFromWindow(contentWindow) {
    return Promise.resolve().then(function () {
        // First, try to find the flashvars
        let flashvars;
        
        let moviePlayer = contentWindow.document.getElementById("movie_player") ||
            contentWindow.document.getElementById("movie_player-flash");
        if (moviePlayer) {
            let flashvars = moviePlayer.getAttribute("flashvars");
            if (flashvars) {
                return parseFlashvars(flashvars);
            }
            
            // Try getting flashvars as if movie_player is an <object>
            try {
                flashvars = moviePlayer.getElementsByName("flashvars")[0].getAttribute("value");
            } catch (err) {}
            if (flashvars) {
                return parseFlashvars(flashvars);
            }
        }
        
        // Let's try snooping around YouTube's JavaScript
        // https://developer.mozilla.org/en/XPCNativeWrapper#Accessing_unsafe_properties
        if (contentWindow.wrappedJSObject) {
            let args = contentWindow.wrappedJSObject.yt &&
                       contentWindow.wrappedJSObject.yt.config_ &&
                       contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG &&
                       contentWindow.wrappedJSObject.yt.config_.PLAYER_CONFIG.args;
            if (!args) {
                args = contentWindow.wrappedJSObject.ytplayer &&
                       contentWindow.wrappedJSObject.ytplayer.config &&
                       contentWindow.wrappedJSObject.ytplayer.config.args;
            }
            
            if (args && typeof args == "object") {
                return parseFlashvars(args);
            }
        }
        
        // We still have nothing; let's try to find the flashvars somewhere in the page
        try {
            var allBody = contentWindow.document.documentElement.innerHTML;
            var flashvarsCount = allBody.match(/flashvars="/g).length;
            if (flashvarsCount == 1) {
                // We'll assume this is the movie player
                flashvars = mpUtils.getFromString(allBody, 'flashvars="', '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
            } else if (flashvarsCount > 1) {
                // Try to find the movie player
                while (allBody.indexOf('flashvars="') != -1) {
                    allBody = mpUtils.getFromString(allBody, 'flashvars="');
                    var tempFlashvars = mpUtils.getFromString(allBody, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                    allBody = mpUtils.getFromString(allBody, '"');
                    
                    if (tempFlashvars.indexOf("&video_id=") != -1) {
                        // Let's assume this is it (but still go through the rest in case we find a better cantidate)
                        flashvars = tempFlashvars;
                    }
                }
            }
        } catch (err) {}
        if (flashvars) {
            return parseFlashvars(flashvars);
        }
        
        // If we're still here, we couldn't find any flashvars
        // Rejecting this will let it resort to AJAX
        return Promise.reject();
        
    }).catch(function (err) {
        // Whatever we tried above didn't work...
        // Let's try to find the ID from within the window, and resort to AJAX
        let videoID = findIdFromWindow(contentWindow);
        if (!videoID) {
            return Promise.reject(mpUtils.createSiteError("TODO: Error message... no video ID..."));
        }
        return getDataFromId(videoID, contentWindow.location.href);
    });
}

/**
 * Try to find a video ID from within a content window.
 *
 * @return {string?} - The video ID, or `null` if we couldn't find one.
 */
function findIdFromWindow(contentWindow) {
    if (!contentWindow) return null;
    
    let url = mpUtils.getURLParts(contentWindow.location);
    if (url.query && url.query.v) {
        return url.query.v;
    }
    
    let allBody = contentWindow.document.documentElement.innerHTML, index;
    
    let videoID = mpUtils.getFromString(allBody, "&video_id=", "&");
    if (videoID) return videoID;
    videoID = mpUtils.getFromString(allBody, '"video_id": "', '"');
    if (videoID) return videoID;
    
    // Search for tags with the name "video_id" (very last resort)
    var namedTags = contentWindow.document.getElementsByName("video_id");
    for (var i = 0; i < namedTags.length; i++) {
        if (namedTags[i].getAttribute("value")) {
            return namedTags[i].getAttribute("value");
        }
    }
    
    // Didn't find nothing :(
    return null;
}

/**
 * Query via AJAX for flashvars and parse data from them.
 *
 * @param {string} videoID - The ID of the video to look up.
 * @param {string} [referrer] - The page that the video was embedded on, if
 *        applicable.
 *
 * @return {Promise.<Object>} Data about the video (see parseFlashvars return
 *         value).
 */
function getDataFromId(videoID, referrer) {
    let url = "https://www.youtube.com/get_video_info?video_id=" + videoID;
    if (referrer) url += "&eurl=" + encodeURIComponent(referrer);
    return mpUtils.request("GET", url).then(function (responseText) {
        return parseFlashvars(responseText);
    }, function (req) {
        return Promise.reject(mpUtils.createSiteError(
            mpUtils.getString("mp4downloader", "error_ajax", ["YouTube", req.status.toString()]),
            {
                response: req.responseText,
                videoID: videoID,
                referrer: referrer
            }
        ));
    });
}

/**
 * Look for common errors in the flashvars, and return an Error (generated by
 * mpUtils.createSiteError).
 */
function createFlashvarsError(flashvars) {
    if (typeof flashvars == "string") flashvars = mpUtils.parseQuery(flashvars);
    if (flashvars.status != "fail") {
        // YouTube didn't report any error :(
        return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_generic", ["youtube.ajax", "no format-url-stream map"]), {
            videoID: videoID,
            flashvars: flashvars
        });
    }
    
    let code = flashvars.errorcode || "00";
    let reason = flashvars.reason || "nothing";
    if (reason.indexOf("<br") != -1) reason = reason.substring(0, reason.indexOf("<br"));
    
    // TODO: These tests don't work if the user's browser is in a different locale!
    // (YouTube's error messages will be in a different language.)
    
    // TODO: This will happen if we're on YouTube but they're using HTML5 (so we need to be able to get metadata from the HTML5 player)
    if (reason.toLowerCase().indexOf("embedding disabled by request") == 0 || reason.toLowerCase().indexOf("it is restricted from playback on certain sites") != -1) {
        return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_noembed", ["YouTube"]));
    }
    
    if (reason.toLowerCase().indexOf("this video is not available in your country") == 0 || reason.toLowerCase().indexOf("the uploader has not made this video available in your country") == 0) {
        return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_blocked"));
    }
    
    if (reason.toLowerCase().indexOf("this video is private") == 0) {
        return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_private"));
    }
    
    if (reason.toLowerCase().indexOf("this video contains content from") == 0) {
        return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_copyright", ["YouTube", reason]));
    }
    
    return mpUtils.createSiteError(mpUtils.getString("mp4downloader", "error_youtube_getvideoinfo", [code, reason]), {
        videoID: videoID,
        flashvars: flashvars
    });
}




