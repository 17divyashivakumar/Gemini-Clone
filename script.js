const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// ✅ WARNING: Move this to backend in production!
const API_KEY = "";//In this you can add your API_KEY
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
const chatHistory = [];
const userData = { message: "", file: {} };

const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth"
});

const typingEffect = (text, textElement, botMsgDIV) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;

    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botMsgDIV.classList.remove("loading");
            document.body.classList.remove("bot-responding");
        }
    }, 40);
};

const generateResponse = async (botMsgDIV, userMessage) => {
    const textElement = botMsgDIV.querySelector(".message-text");
    controller = new AbortController();

    chatHistory.push({
        role: "user",
        parts: [{ text: userMessage }, ...(userData.file?.data ? [{
            inline_data: {
                mime_type: userData.file.type,
                data: userData.file.data
            }
        }] : [])]
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text
            ?.replace(/\*\*([^*]+)\*\*/g, "$1")
            ?.trim() || "No response from bot.";

        typingEffect(responseText, textElement, botMsgDIV);

        chatHistory.push({ role: "model", parts: [{ text: responseText }] });
    } catch (error) {
        textElement.style.color = "#d62939";
        if (error.name === "AbortError") {
            textElement.textContent = "Response generation stopped";
        } else if (error.message.includes("network") || error.message.includes("Failed to fetch")) {
            textElement.textContent = "Network error. Please try again."; // ✅ friendlier error
        } else {
            textElement.textContent = error.message;
        }
        botMsgDIV.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    } finally {
        userData.file = {};
    }
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    promptInput.value = "";
    userData.message = userMessage;
    document.body.classList.add("bot-responding","chats-active");
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    const userMsgHTML = `
        <p class="message-text"></p>
        ${userData.file.data ? (
            userData.file.isImage
                ? `<img src="data:${userData.file.type};base64,${userData.file.data}" class="img-attachment"/>`
                : `<p class="file-attachment"><span class="material-symbols-rounded">description</span> ${userData.file.name}</p>`
        ) : ""}`;

    const userMsgDIV = createMsgElement(userMsgHTML, "user-message");
    userMsgDIV.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDIV);
    scrollToBottom();

    setTimeout(() => {
        const botMsgHTML = '<img src="gemini-chatbot-logo.svg" class="avatar"><p class="message-text">Just a sec..</p>';
        const botMsgDIV = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDIV);
        scrollToBottom();
        generateResponse(botMsgDIV, userMessage);
    }, 600);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    // ✅ File size and type validation
    if (!file.type) {
        alert("Unsupported file format.");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert("File size too large. Max 5MB allowed.");
        return;
    }

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];

        if (isImage) {
            fileUploadWrapper.querySelector("img").src = e.target.result;
        }

        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

        userData.file = {
            data: base64String,
            type: file.type,
            name: file.name,
            isImage
        };
    };
});

document.querySelector(".cancel-file-btn").addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
    userData.file = {};
    controller?.abort();
    clearInterval(typingInterval);
    const loadingBot = chatsContainer.querySelector(".bot-message.loading");
    if (loadingBot) loadingBot.classList.remove("loading"); // ✅ prevent error if not present
    document.body.classList.remove("bot-responding");
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding","chats-active");
});

document.querySelectorAll(".suggestions-item").forEach(item =>{
    item.addEventListener("click",()=>{
        promptInput.value = item.querySelector(".text").textContent
        promptForm.dispatchEvent(new Event("submit"))
    })
})

document.addEventListener("click",({target})=>{
    const wrapper = document.querySelector(".prompt-wrapper")
    const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"))
    wrapper.classList.toggle("hide-controls", shouldHide)
})

themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode"; // ✅ fix from "light-mode"
});

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode"; // ✅ fix

promptForm.addEventListener("submit", handleFormSubmit);
document.querySelector(".add-file-btn").addEventListener("click", () => {
    fileInput.click();
});
