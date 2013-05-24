/*
    MP4 Downloader Bookmarklet
    Copyright (C) 2013 Jake Hartz
    
    This is the minified version of this file.
    See bookmarklet.js for full source code and license.
*/
(function(){try{var w="http://mp4downloader.mozdev.org/contact",v="mp4downloader_BOOKMARKLET_",o=v.toLowerCase(),p=v.substring(0,v.length-1),F=v+"CONFIG",E=decodeURIComponent,D=encodeURIComponent;if(!window[F]){window[F]={}}var r;try{r=window.location.hostname;if(!r){throw"nohost"}}catch(k){r=window.location.href;if(r.indexOf(":")!=-1){r=r.substring(r.indexOf(":")+1);while(r.indexOf("/")==0){r=r.substring(1)}}if(r.indexOf("/")!=-1){r=r.substring(0,r.indexOf("/"))}}var u=window.location.pathname;var h=(window.location.search?"&"+window.location.search.substring(1):"");var f=function(i,d,e){if(i&&d&&i.indexOf(d)!=-1){var j=i.substring(i.indexOf(d)+d.length);if(e&&j.indexOf(e)!=-1){j=j.substring(0,j.indexOf(e))}return j}else{return false}};var y=function(e,d){alert("MP4 Downloader Error: "+e+"\nPlease report this error at "+w+(d?" and include the video you were on and these details:\n\n"+d:""))};var C=false;if(window[F].useHQ||f(h,"&"+o+"useHQ=","&")||f(h,"&"+o+"useHD=","&")){C=true}else{if(!f(h,"&"+o+"noHQ=","&")&&!window[F].noHQ&&(f(h,"&hd=","&")=="1"||f(h,"&fmt=","&")=="22"||f(h,"&fmt=","&")=="37")){C=true}}var l=function(i,e){var d=new XMLHttpRequest();d.open("GET","http://www.youtube"+(r.indexOf("nocookie")!=-1?"-nocookie":"")+".com/get_video_info?video_id="+i+"&eurl="+D(window.location.href),true);d.onreadystatechange=function(){if(d.readyState==4){if(d.status==200){try{var N=d.responseText;if(N.indexOf("&title=")!=-1){e=E(f(N,"&title=","&"));if(e.indexOf("+")!=-1){e=e.replace(/\+/g," ")}}if(N.indexOf("&url_encoded_fmt_stream_map=")!=-1){var M,I,P;var O=E(f(N,"&url_encoded_fmt_stream_map=","&")).split(",");for(var L=0;L<O.length;L++){var R,H,S;var Q=O[L].split("&");for(var K=0;K<Q.length;K++){if(Q[K].substring(0,4)=="itag"){R=Q[K].substring(5)}else{if(Q[K].substring(0,3)=="url"){H=E(Q[K].substring(4))}else{if(Q[K].substring(0,3)=="sig"){S=E(Q[K].substring(4))}}}}H+="&signature="+S;if(R=="18"){M=H}if(R=="22"){I=H}if(R=="37"){P=H}}if((C||!M)&&(I||P)){if(P){location.href=P+"&title="+D(e.replace(/\//g,"-"))}else{if(I){location.href=I+"&title="+D(e.replace(/\//g,"-"))}else{y("There was a problem downloading the high quality video.","Cannot find fmt37url or fmt22url even though they exist in mapping.")}}}else{if(M){location.href=M+"&title="+D(e.replace(/\//g,"-"))}else{y("MP4 Downloader cannot download this video!",'bookmarklet: "no MP4 format inside the format-url map"')}}}else{if(N.indexOf("status=fail")!=-1){y("MP4 Downloader cannot download this video due to a YouTube get_video_info error!"+(N.indexOf("&reason=")!=-1?"\nYouTube responded with"+(N.indexOf("&errorcode=")!=-1?" error "+f(N,"&errorcode=","&"):"")+': "'+E(f(N,"&reason=","&").replace(/\+/g," "))+'"':""))}else{y("MP4 Downloader cannot download video!",'bookmarklet: "no format-url map"')}}}catch(J){y("There was a problem during the AJAX request.",J)}}}};d.send()};if((r.substring(r.length-11)=="youtube.com"||r.substring(r.length-20)=="youtube-nocookie.com")&&(u=="/watch"||document.getElementById("channel-body"))){var m=f(h,"&v=","&");var q;if(document.getElementById("channel-body")){q=(document.getElementById("playnav-curvideo-title").textContent||document.getElementById("playnav-curvideo-title").innerText).replace(/^\s\s*/,"").replace(/\s\s*$/,"")}else{if(document.title.lastIndexOf(" - YouTube")==document.title.length-10){q=document.title.substring(0,document.title.length-10)}else{if(document.title.indexOf("YouTube - ")==0){q=document.title.substring(10)}else{q=document.title}}}if(document.getElementById("movie_player")){var t=document.getElementById("movie_player").getAttribute("flashvars");if(!t){try{t=document.getElementById("movie_player").getElementsByName("flashvars")[0].getAttribute("value")}catch(k){}}m=f(t,"&video_id=","&")||m;if(t&&t.indexOf("&url_encoded_fmt_stream_map=")!=-1){var G,x,a;var s=E(f(t,"&url_encoded_fmt_stream_map=","&")).split(",");for(var A=0;A<s.length;A++){var B,g,c;var n=s[A].split("&");for(var z=0;z<n.length;z++){if(n[z].substring(0,4)=="itag"){B=n[z].substring(5)}else{if(n[z].substring(0,3)=="url"){g=E(n[z].substring(4))}else{if(n[z].substring(0,3)=="sig"){c=E(n[z].substring(4))}}}}g+="&signature="+c;if(B=="18"){G=g}if(B=="22"){x=g}if(B=="37"){a=g}}if((C||!G)&&(x||a)){if(a){location.href=a+"&title="+D(q.replace(/\//g,"-"))}else{if(x){location.href=x+"&title="+D(q.replace(/\//g,"-"))}else{y("There was a problem downloading the high quality video.","Cannot find fmt37url or fmt22url even though they exist inside mapping.")}}}else{if(G){location.href=G+"&title="+D(q.replace(/\//g,"-"))}else{l(m,q)}}}else{l(m,q)}}else{if(m){l(m,q)}else{if(document.documentElement.innerHTML.indexOf("&video_id=")!=-1){l(f(document.documentElement.innerHTML,"&video_id=","&"),q)}else{if(document.documentElement.innerHTML.indexOf('"video_id": "')!=-1){l(f(document.documentElement.innerHTML,'"video_id": "','"'),q)}else{var b=document.getElementsByName("video_id");var m;if(b.length>0){for(var A=0;A<b.length;A++){if(b[A].getAttribute("value")){m=b[A].getAttribute("value");break}}}if(m){l(m,q)}else{alert("MP4 Downloader cannot download this video! Please try again and make sure that the video can play on YouTube.\n\nIf this error continues, please contact us at "+w+' and specify that "movie_player" was not found and no workaround was successful.')}}}}}}else{alert("This page does not contain a supported video. Please try downloading from YouTube.\n\nIf you have problems, contact us at "+w)}}catch(k){y("Global Error",k)}})();