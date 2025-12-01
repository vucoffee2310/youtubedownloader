(function() {
  if (document.getElementById("gemini-tts-panel")) return;
  
  var panel = document.createElement("div");
  panel.id = "gemini-tts-panel";
  panel.innerHTML = 
    '<h3>Gemini TTS</h3>' +
    '<textarea id="tts-text" placeholder="Enter text...">Xin chào, tôi là trợ lý ảo</textarea>' +
    '<div class="controls">' +
      '<select id="tts-lang">' +
        '<option value="vi">Vietnamese</option>' +
        '<option value="en">English</option>' +
        '<option value="fr">French</option>' +
        '<option value="de">German</option>' +
        '<option value="ja">Japanese</option>' +
        '<option value="ko">Korean</option>' +
        '<option value="zh">Chinese</option>' +
        '<option value="es">Spanish</option>' +
        '<option value="th">Thai</option>' +
      '</select>' +
      '<button id="tts-generate">Generate</button>' +
      '<button id="tts-close" class="close-btn">Close</button>' +
    '</div>' +
    '<div id="tts-status" class="status"></div>' +
    '<div id="tts-audio"></div>';
  
  document.body.appendChild(panel);
  
  var textInput = document.getElementById("tts-text");
  var langSelect = document.getElementById("tts-lang");
  var generateBtn = document.getElementById("tts-generate");
  var closeBtn = document.getElementById("tts-close");
  var statusDiv = document.getElementById("tts-status");
  var audioDiv = document.getElementById("tts-audio");
  
  closeBtn.addEventListener("click", function() {
    panel.remove();
  });
  
  generateBtn.addEventListener("click", function() {
    var text = textInput.value.trim();
    var lang = langSelect.value;
    
    if (!text) {
      showStatus("Please enter text", "error");
      return;
    }
    
    generateBtn.disabled = true;
    showStatus("Generating...", "loading");
    
    var payload = JSON.stringify([[["XqA3Ic", JSON.stringify([null, text, lang, null, 2]), null, "generic"]]]);
    
    fetch("/_/BardChatUi/data/batchexecute?" + new URLSearchParams({
      rpcids: "XqA3Ic",
      "source-path": "/app",
      bl: "boq_assistant-bard-web-server_20251123.09_p0",
      hl: lang,
      _reqid: Math.floor(Math.random() * 9000000) + 1000000,
      rt: "c"
    }), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-same-domain": "1"
      },
      body: "f.req=" + encodeURIComponent(payload),
      credentials: "include"
    })
    .then(function(response) {
      if (!response.ok) throw new Error("Request failed: " + response.status);
      return response.text();
    })
    .then(function(text) {
      var match = /(\[\["wrb.fr".*?"generic"]])/.exec(text);
      if (!match) throw new Error("No audio data found");
      var jsonArray = JSON.parse(match[1].trim());
      var base64Audio = JSON.parse(jsonArray[0][2])[0];
      
      var audio = document.createElement("audio");
      audio.controls = true;
      audio.src = "data:audio/mp3;base64," + base64Audio;
      
      audioDiv.innerHTML = "";
      audioDiv.appendChild(audio);
      
      showStatus("Done!", "success");
      audio.play();
    })
    .catch(function(err) {
      showStatus("Error: " + err.message, "error");
    })
    .finally(function() {
      generateBtn.disabled = false;
    });
  });
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = "status " + type;
  }
})();