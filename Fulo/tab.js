var textInput = document.getElementById("text");
var langSelect = document.getElementById("lang");
var generateBtn = document.getElementById("generate");
var clearBtn = document.getElementById("clear");
var status = document.getElementById("status");
var audioContainer = document.getElementById("audioContainer");

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
  
  fetch("https://gemini.google.com/_/BardChatUi/data/batchexecute?" + new URLSearchParams({
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
    
    audioContainer.innerHTML = "";
    audioContainer.appendChild(audio);
    
    showStatus("Done!", "success");
    audio.play();
  })
  .catch(function(err) {
    showStatus("Error: " + err.message + ". Login to gemini.google.com first.", "error");
  })
  .finally(function() {
    generateBtn.disabled = false;
  });
});

clearBtn.addEventListener("click", function() {
  textInput.value = "";
  audioContainer.innerHTML = "";
  status.textContent = "";
  status.className = "";
});

function showStatus(message, type) {
  status.textContent = message;
  status.className = type;
}