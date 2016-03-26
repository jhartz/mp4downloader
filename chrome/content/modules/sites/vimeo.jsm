/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 */

// See: https://github.com/jhartz/mp4downloader/wiki/Video-Site-Module

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["vimeo"];

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");


/* MP4 DOWNLOADER API */

var vimeo = {
    testWindow: function (contentWindow, downloadButtonCallback) {
        /////////////////////
        return false;
        /////////////////////
        
        
        return new Promise(function (resolve, reject) {
            if (!isVideoPage(contentWindow)) {
                resolve(false);
                return;
            }
            
            // TODO: AJAX
            /*
            if (path.substring(0, 11) == "/couchmode/") {
                this.ajax.vimeo(path.match(/^\/couchmode.*\/([0-9]+)$/)[1], contentWindow.location.href);
            } else {
                this.ajax.vimeo(path.match(/^\/([0-9]+)/)[1], contentWindow.location.href);
            }
            */
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


/* VIMEO-SPECIFIC FUNCTIONS */

function isVideoPage(contentWindow) {
    return (
        host.substring(host.length - 9) == "vimeo.com" &&
        (
            (
                path.substring(0, 11) == "/couchmode/" &&
                path.search(/^\/couchmode.*\/([0-9]+)$/) != -1
            ) ||
            path.search(/^\/([0-9]+)/) != -1
        )
    );
}


function ajax(videoID, referURL) {
    // NOTE: Taken almost verbatim from old overlay.js code
    return new Promise(function (resolve, reject) {
        var Req = mpUtils.getXMLHttpRequest();
        Req.open("GET", "http://player.vimeo.com/config/" + videoID + (referURL ? "?referrer=" + encodeURIComponent(referURL) : ""), true);
        Req.onreadystatechange = function () {
            if (Req.readyState == 4) {
                if (Req.status == 200 && Req.responseText) {
                    mpUtils.log("Vimeo AJAX received");
                    var data = JSON.parse(Req.responseText);
                    if (data && data.request && data.video) {
                        // Make sure H264 version is available (some videos just have VP6 (flv container) or something else)
                        if (typeof data.video.files.h264 != "undefined") {
                            var videoTitle = data.video.title;
                            var videoAuthor = data.video.owner.name || null;
                            if (mpUtils.prefs.getBoolPref("hq") && data.video.hd) {
                                mp4downloader.saveVideo("http://" + data.request.player_url + "/play_redirect?quality=hd&codecs=h264&clip_id=" + data.video.id + "&time=" + data.request.timestamp + "&sig=" + data.request.signature + "&type=html5_desktop_embed", "http://vimeo.com/" + videoID, videoTitle, videoAuthor, "Vimeo", true);
                            } else {
                                mp4downloader.saveVideo("http://" + data.request.player_url + "/play_redirect?quality=sd&codecs=h264&clip_id=" + data.video.id + "&time=" + data.request.timestamp + "&sig=" + data.request.signature + "&type=html5_desktop_embed", "http://vimeo.com/" + videoID, videoTitle, videoAuthor, "Vimeo", false);
                            }
                        } else {
                            mpUtils.alert(mpUtils.getString("mp4downloader", "error_noMP4", ["Vimeo"]));
                        }
                    } else if (data && data.title && data.title == "Sorry") {
                        mpUtils.error(mpUtils.getString("mp4downloader", "error_vimeo", [data.message ? data.message.replace(/\\\//g, "/") : "nothing"]));
                    } else {
                        mpUtils.error(mpUtils.getString("mp4downloader", "error_generic", ["ajax.vimeo", "cannot get JSON data"]));
                    }
                } else {
                    mpUtils.error(mpUtils.getString("mp4downloader", "error_ajax", ["Vimeo", Req.status.toString()]), "videoID: " + videoID + (referURL ? "\nRefer URL: " + referURL : ""));
                }
            }
        };
        Req.send(null);
    });
}
