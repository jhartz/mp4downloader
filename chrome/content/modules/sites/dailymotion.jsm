/*
    Copyright (C) 2016  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var EXPORTED_SYMBOLS = ["dailymotion"];

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");


/* MP4 DOWNLOADER API */

var dailymotion = {
    testWindow: function (contentWindow, downloadButtonCallback) {
        return new Promise(function (resolve, reject) {
            if (!isVideoPage(contentWindow)) {
                resolve(false);
                return;
            }
            
            var flashvars = findFlashvars(contentWindow);
            if (flashvars) {
                resolve(parseSequence(flashvars));
            } else {
                // TODO: AJAX
                //this.ajax.dailymotion(path.substring(7));
            }
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


/* DAILYMOTION-SPECIFIC FUNCTIONS */

var FORMAT_NAMES = {
    "sdURL": "Standard Quality",
    "hqURL": "High Quality",
    "hdURL": "Higher Quality",
    "hd720URL": "720p HD",
    "hd1080URL": "1080p HD"
};

function isVideoPage(contentWindow) {
    var url = mpUtils.getURLParts(contentWindow.location);
    return (
        host.substring(host.length - 15) == "dailymotion.com" &&
        path.substring(0, 6) == "/video"
    );
}

function findFlashvars(contentWindow) {
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
    return flashvars ? ("&" + flashvars) : false;
}

function parseSequence(flashvars, returnUrls) {
    if (!flashvars) return false;
    var sequence = decodeURIComponent(this.util.getFromString(flashvars, "&sequence=", "&"));
    if (!sequence) return false;
    
    //var videoTitle = (contentWindow.document.getElementById("content") || contentWindow.document.getElementById("wrapper") || contentWindow.document.body || contentWindow.document).getElementsByTagName("h1")[0].textContent.trim();
    //var videoAuthor = this.util.getFromString(sequence, '"videoOwnerLogin":"', '"').replace(/\\\//g, "/") || null;
    
    var urlsByFormat = {},
        formats = [];
    (["hd1080URL", "hd720URL", "hdURL", "hqURL", "sdURL"]).forEach(function (format) {
        if (sequence.indexOf(format) == -1) return;
        var url = mpUtils.getFromString(sequence, '"' + format + '":"', '"').replace(/\\\//g, "/");
        if (url && url.indexOf(".mp4") != -1) {
            urlsByFormat[format] = url;
            formats.push({
                name: FORMAT_NAMES[format],
                quality: format
            });
        }
    });
    
    if (formats.length == 0) {
        return false;
    } else if (returnUrls) {
        return urlsByFormat;
    } else {
        return formats;
    }
}

function ajax(videoID) {
    // NOTE: Taken almost verbatim from old overlay.js code
    return new Promise(function (resolve, reject) {
        var Req = mpUtils.getXMLHttpRequest();
        Req.open("GET", "http://www.dailymotion.com/sequence/" + videoID, true);
        Req.onreadystatechange = function () {
            if (Req.readyState == 4) {
                if (Req.status == 200 && Req.responseText) {
                    mpUtils.log("Dailymotion AJAX received (sequence)");
                    
                    // We need to get the sequence, find all the strings we need, and put them into a simpler object
                    var sequence = JSON.parse(Req.responseText);
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
                        
                        var videoTitle = vars["videoTitle"] || mpUtils.getString("mp4downloader", "sitevideo", ["Dailymotion"]);
                        var videoAuthor = vars["videoOwnerLogin"] || null;
                        
                        var videoURLs = [];
                        if (vars["sdURL"] && vars["sdURL"].indexOf(".mp4") != -1) videoURLs.push(vars["sdURL"]);
                        if (vars["hqURL"] && vars["hqURL"].indexOf(".mp4") != -1) videoURLs.push(vars["hqURL"]);
                        if (vars["hdURL"] && vars["hdURL"].indexOf(".mp4") != -1) videoURLs.push(vars["hdURL"]);
                        if (vars["hd720URL"] && vars["hd720URL"].indexOf(".mp4") != -1) videoURLs.push(vars["hd720URL"]);
                        if (vars["hd1080URL"] && vars["hd1080URL"].indexOf(".mp4") != -1) videoURLs.push(vars["hd1080URL"]);
                        
                        if (videoURLs.length > 0) {
                            if (mpUtils.prefs.getBoolPref("hq")) {
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
                        mpUtils.log("Couldn't parse sequence!");
                    }
                } // (Req.status == 200 && Req.responseText)
                
                // If we're here, then no video was saved...
                var Req2 = new XMLHttpRequest();
                Req2.open("GET", "http://www.dailymotion.com/json/video/" + videoID + "?fields=stream_h264_url,title,url,owner_username", true);
                //Req.open("GET", "http://www.dailymotion.com/json/video/" + videoID + "?fields=stream_h264_ld_url,title,url,owner_username", true);
                Req2.onreadystatechange = function () {
                    if (Req2.readyState == 4) {
                        if (Req2.status == 200 && Req2.responseText) {
                            mpUtils.log("Dailymotion AJAX received (stream_h264_url)");
                            var data = JSON.parse(Req2.responseText);
                            if (data && data.stream_h264_url) {
                                mp4downloader.saveVideo(data.stream_h264_url, data.url || "http://www.dailymotion.com/video/" + videoID, data.title || (typeof videoTitle == "string" && videoTitle) || mpUtils.getString("mp4downloader", "sitevideo", ["Dailymotion"]), data.owner_username || null, "Dailymotion", false);
                                return;
                            } else {
                                mpUtils.alert(mpUtils.getString("mp4downloader", "error_noMP4", ["Dailymotion"]));
                            }
                        } else {
                            mpUtils.error(mpUtils.getString("mp4downloader", "error_ajax", ["Dailymotion", Req.status.toString() + "/" + Req2.status.toString()]), "videoID: " + videoID);
                        }
                    }
                };
                Req2.send(null);
            }
        };
        Req.send(null);
    });
},



