// ========================================================================== //
// 1. GLOBAL STATE & CONFIGURATION
// ========================================================================== //

const AppState = {
    library: {},
    activeSession: {
        currentNovel: null, currentVolume: null, currentChapter: null, currentScroll: null,
        loadedVolume: null, loadedArtBook: null,
        activeMenu: null, activeTLM: null, triggeringButton: null,
        currentButtonPositionX: null, currentButtonPositionY: null,
        isArtBook: null,
        settings: { currentTextColor: null, currentBgColor: null, currentFontSize: null, currentFont: null, currentBgColorList: [], currentTextColorList: [] },
        isDownloadMode: false
    },
    storedData: {
        lastNovel: null, novelSaves: {},
        buttonPositionX: null, buttonPositionY: null,
        settings: { textColor: null, bgColor: null, fontSize: null, font: null, bgColorList: [], textColorList: [] }
    }
};

const viewList = ["mainMenu", "volumeMenu", "reader"];
const tlmList = ["mainTLM", "chapterSelect", "settings", "colorListText", "colorListBG"];
const STORAGE_KEY = "novelReader_offlineSaveData";

// ========================================================================== //
// 2. BOOTSTRAP & INITIALIZATION
// ========================================================================== //

async function main() {
    registerServiceWorker();
    getFromLocalStorage();
    await allTLMInit();
    readerInit();
    await loadLibraryIndex();
    mainMenuInit(); 
    volumeMenuInit();
}

async function loadLibraryIndex() {
    try {
        const response = await fetch('Novel-Library/index.json');
        const indexData = await response.json();
        AppState.library = indexData;
        console.log("Library loaded successfully:", AppState.library);
        buildMainMenu(); 
    } catch (error) {
        console.error("Failed to load the index file. Is it in the right folder?", error);
    }
}

function mainMenuInit() {
    const searchButton = document.getElementById("menuSearch");
    if (searchButton) searchButton.addEventListener("pointerup", () => { /* searchNovel(); */ });
}

function volumeMenuInit() {
    const backButton = document.getElementById("b_backFloat");
    const downloadButton = document.getElementById("b_volumeDownload");
    downloadButton.addEventListener("pointerup", () => toggleDownloadMode());
    backButton.addEventListener("pointerup", () => viewSwitcher("mainMenu"));
}

function readerInit() {
    document.getElementById("generic-lightbox-overlay").addEventListener("pointerup", (e) => {
        if (e.target.id !== "generic-lightbox-image") closeGenericLightbox();
    });
}

async function allTLMInit() {
    await tlmButtonInit();
    tlmOverlayInit();
    mainTLMInit();
    settingsTLMInit();
    chooseChapTLMInit();
    textColorTLMInit();
    bgColorTLMInit();
}

function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(() => console.log("Offline Engine (Service Worker) Registered!"))
            .catch(err => console.error("SW Registration failed", err));
    }
}

// ========================================================================== //
// 3. STORAGE, CACHING, & OFFLINE SYSTEMS
// ========================================================================== //

function saveToLocalStorage(dataObject){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataObject));
}

function getFromLocalStorage(){
    const savedString = localStorage.getItem(STORAGE_KEY);
    if (!savedString) return;
    AppState.storedData = JSON.parse(savedString);
}

function getSaveData(novelName){
    if (AppState.storedData.novelSaves[novelName] || (novelName == null && AppState.storedData.novelSaves[novelName])){
        AppState.activeSession.currentVolume = AppState.storedData.novelSaves[novelName].volume;
        AppState.activeSession.currentChapter = AppState.storedData.novelSaves[novelName].chapter;
        AppState.activeSession.currentScroll = AppState.storedData.novelSaves[novelName].scroll;
        return;
    }
    AppState.activeSession.currentVolume =  1;
    AppState.activeSession.currentChapter = 1;
    AppState.activeSession.currentScroll =  0;
}

function updateSaveData(){  
    AppState.storedData.lastNovel = AppState.activeSession.currentNovel;
    AppState.storedData.novelSaves[AppState.activeSession.currentNovel] = {
        volume: AppState.activeSession.currentVolume,
        chapter: AppState.activeSession.currentChapter,
        scroll: AppState.activeSession.currentScroll
    };
    saveToLocalStorage(AppState.storedData);
}

function getSavedPos(){
    AppState.activeSession.currentButtonPositionX = AppState.storedData.buttonPositionX;
    AppState.activeSession.currentButtonPositionY = AppState.storedData.buttonPositionY;
}

function updateSavedPos(){
    if (AppState.activeSession.currentButtonPositionX == null || AppState.activeSession.currentButtonPositionY == null) {
        AppState.storedData.buttonPositionX = 0 + "px";
        AppState.storedData.buttonPositionY = 0 + "px";
    }
    AppState.storedData.buttonPositionX = AppState.activeSession.currentButtonPositionX;
    AppState.storedData.buttonPositionY = AppState.activeSession.currentButtonPositionY;
}

async function isVolumeDownloaded(desiredURL){
    const cache = await caches.open("volume-downloads-v5");
    const response = await cache.match(desiredURL);
    return !!response; 
} 

function downloadVolume(volumeURL){
    if (navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage({ action: "MANUAL_SAVE", targetUrl: volumeURL });
    } else {
        console.warn("The Service Worker is not controlling this page yet.");
    }
}

function deleteVolumeDownload(volumeURL){
    if (navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage({ action: "MANUAL_DELETE", targetUrl: volumeURL });
    } else {
        console.warn("The Service Worker is not controlling this page yet.");
    }
}

// ========================================================================== //
// 4. ROUTING & VIEW SWITCHING
// ========================================================================== //

function viewSwitcher(targetViewId) {
    if (targetViewId === "mainMenu") buildMainMenu();
    viewList.forEach(viewId => {
        const element = document.getElementById(viewId);
        if (viewId === targetViewId) element.classList.replace("hidden", "active");
        else element.classList.replace("active", "hidden");
    });
}

async function openVolumeMenu(novel) {
    await buildVolumeMenu(novel);
    viewSwitcher("volumeMenu");
}

async function returnToVolume() {
    await buildVolumeMenu(AppState.activeSession.currentNovel);
    closeTLM("none");
    viewSwitcher("volumeMenu");
}

async function openReader() {
    await fetchVolume();
    await buildReader();
    viewSwitcher("reader");
}

async function toggleDownloadMode() {
    AppState.activeSession.isDownloadMode = !AppState.activeSession.isDownloadMode;
    const pillContainer = document.getElementById("volumeButtonContainer");
    const allVolumeElements = document.querySelectorAll(".volumeBookCover");
    pillContainer.innerHTML = "";

    if (AppState.activeSession.isDownloadMode) {
        const backButton = document.createElement("button");
        backButton.id = "b_backFloat";
        backButton.innerHTML = "Back";
        backButton.addEventListener("pointerup", () => toggleDownloadMode());
        pillContainer.appendChild(backButton);

        for (let item of allVolumeElements) {
            const fileUrl = item.getAttribute("data-file-url"); 
            const isSaved = await isVolumeDownloaded(fileUrl);
            if (isSaved) item.classList.add("status-downloaded");
            else item.classList.add("status-missing");
        }
    } else {
        const backButton = document.createElement("button");
        backButton.id = "b_backFloat";
        backButton.innerHTML = "Back";
        backButton.addEventListener("pointerup", () => viewSwitcher("mainMenu"));

        const downloadButton = document.createElement("button");
        downloadButton.id = "b_volumeDownload";
        downloadButton.classList.add("b_download");
        downloadButton.innerHTML = "Download";
        downloadButton.addEventListener("pointerup", () => toggleDownloadMode());

        const searchButton = document.createElement("button");
        searchButton.id = "volumeSearch";
        searchButton.classList.add("b_search");
        searchButton.innerHTML = "Search";

        pillContainer.appendChild(backButton);
        pillContainer.appendChild(downloadButton);
        pillContainer.appendChild(searchButton);
        
        allVolumeElements.forEach(item => item.classList.remove("status-downloaded", "status-missing"));
    }
}

// ========================================================================== //
// 5. DOM RENDERERS (MENUS & READERS)
// ========================================================================== //

async function buildMainMenu() {
    const novelMenuBooks = document.getElementById("mainMenuBooks");
    const novelMenuBar = document.getElementById("menuInfoBar");
    novelMenuBooks.innerHTML = "";
    novelMenuBar.innerHTML = "";

    const menuTopH = document.createElement("h1");
    menuTopH.classList.add("appTitle");
    menuTopH.innerHTML = "Ben's Novel Reader";

    const menuTopP = document.createElement("p");
    menuTopP.classList.add("currentSeriesText");
    if (AppState.storedData.lastNovel == null) {
        menuTopP.innerHTML = "Start Reading Something!";
    } else {
        if (AppState.activeSession.currentNovel == null) getSaveData(AppState.storedData.lastNovel);
        menuTopP.innerHTML = `<b>Last Novel: </b>${AppState.storedData.lastNovel} <b>Chapter: </b> ${AppState.activeSession.currentChapter}`;
    }

    novelMenuBar.appendChild(menuTopH);
    novelMenuBar.appendChild(menuTopP);

    AppState.library.forEach(novelContainer => {
        let pressTimer, wasHeld;
        const novelName = novelContainer.seriesName;
        const novelCamelCase = novelName.trim().toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, m) => m.toUpperCase());

        const novelDivContainer = document.createElement("div");
        novelDivContainer.id = novelCamelCase + "Button";
        novelDivContainer.classList.add("bookAndTitle");

        const coverDiv = document.createElement("div");
        coverDiv.id = novelCamelCase;
        coverDiv.classList.add("bookCover");
        coverDiv.style.backgroundImage = `url('${novelContainer.coverImagePath}')`;

        const titleDiv = document.createElement("p");
        titleDiv.classList.add("bookTitle");
        titleDiv.innerHTML = novelName;

        novelDivContainer.appendChild(coverDiv);
        novelDivContainer.appendChild(titleDiv);

        novelDivContainer.addEventListener("pointerdown", () => {
            wasHeld = false;
            pressTimer = setTimeout(() => {
                wasHeld = true;
                openVolumeMenu(novelName);
            }, 500); 
        });

        novelDivContainer.addEventListener("pointerup", () => {
            clearTimeout(pressTimer);
            AppState.activeSession.currentNovel = novelName;
            if (!wasHeld) openReader();
        });

        novelMenuBooks.appendChild(novelDivContainer);
    });
}

async function buildVolumeMenu(novelName) {
    const volumeMenuBar = document.getElementById("volumeInfoBar");
    const volumeMenuBooks = document.getElementById("volumeMenuBooks");

    AppState.activeSession.isArtBook = false;
    getSaveData(novelName);

    volumeMenuBar.innerHTML = "";
    volumeMenuBooks.innerHTML = "";

    const novelNameH = document.createElement("h1");
    novelNameH.classList.add("appTitle");
    novelNameH.innerHTML = novelName;

    const novelInfoP = document.createElement("p");
    novelInfoP.classList.add("currentSeriesText");
    novelInfoP.innerHTML = "Volume: " + AppState.activeSession.currentVolume + " Chapter: " + AppState.activeSession.currentChapter;

    volumeMenuBar.appendChild(novelNameH);
    volumeMenuBar.appendChild(novelInfoP);

    const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
    
    currentNovelObj.volumes.forEach(volume => {
        let pressTimer, wasHeld;
        const volumeName = volume.volumeTitle;
        const volumeCamelCase = volumeName.trim().toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, m) => m.toUpperCase());

        const volumeDivContainer = document.createElement("div");
        volumeDivContainer.id = volumeCamelCase + "Button";
        volumeDivContainer.classList.add("bookAndTitle");

        const coverDiv = document.createElement("div");
        coverDiv.id = volumeCamelCase;
        coverDiv.classList.add("bookCover", "volumeBookCover");
        coverDiv.setAttribute("data-file-url", 'Novel-Library/' + volume.fileName);
        coverDiv.style.backgroundImage = `url('${volume.coverImagePath}')`;

        const titleDiv = document.createElement("p");
        titleDiv.classList.add("bookTitle");
        titleDiv.innerHTML = volumeName;

        volumeDivContainer.appendChild(coverDiv);
        volumeDivContainer.appendChild(titleDiv);

        volumeDivContainer.addEventListener("pointerdown", () => {
            wasHeld = false;
            if (!AppState.activeSession.isDownloadMode) pressTimer = setTimeout(() => { wasHeld = true; }, 500); 
        });

        volumeDivContainer.addEventListener("pointerup", () => {
            if (AppState.activeSession.isDownloadMode) {
                const isCurrentlySaved = coverDiv.classList.contains("status-downloaded");
                if (isCurrentlySaved) {
                    deleteVolumeDownload(coverDiv.getAttribute("data-file-url"));
                    coverDiv.classList.replace("status-downloaded", "status-missing");
                } else {
                    downloadVolume(coverDiv.getAttribute("data-file-url"));
                    coverDiv.classList.replace("status-missing", "status-downloaded");
                }
            } else {
                if (!wasHeld) {
                    clearTimeout(pressTimer);
                    if (volume.volumeNumber != 0) {
                        AppState.activeSession.isArtBook = false;
                        AppState.activeSession.currentVolume = volume.volumeNumber;
                        updateSaveData();
                        openReader();
                    } else {
                        AppState.activeSession.isArtBook = true;
                        openReader();
                    }
                }
            }
        });
        volumeMenuBooks.appendChild(volumeDivContainer);
    });
}

async function fetchVolume() {
    const novelName = AppState.activeSession.currentNovel;
    let fileName;
    if (!AppState.activeSession.isArtBook){
        getSaveData(novelName);
        const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
        const currentVolumeObj = currentNovelObj.volumes.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
        fileName = currentVolumeObj.fileName;
    } else {
        const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
        fileName = currentNovelObj.volumes[0].fileName;
    }

    try {
        const response = await fetch('Novel-Library/' + fileName);
        const volumeFetchData = await response.json();
        
        if (AppState.activeSession.isArtBook){
            AppState.activeSession.loadedArtBook = volumeFetchData;
        } else {
            AppState.activeSession.loadedVolume = volumeFetchData;
            updateSaveData();
        }
    } catch (error) {
        console.error("Failed to load the volume file. Is it in the right folder?", error);
    }
}

async function buildReader() {
    if (AppState.activeSession.triggeringButton != null){
        AppState.activeSession.triggeringButton.style.left = AppState.activeSession.currentButtonPositionX;
        AppState.activeSession.triggeringButton.style.top = AppState.activeSession.currentButtonPositionY;
    }
    const chapterContainer = document.getElementById("chapterContent");
    chapterContainer.innerHTML = "";
    const gallryWrapper = document.getElementById("galleryWrapper");

    let desiredChapter;
    let chapterData;

    if (!AppState.activeSession.isArtBook) {
        const currentChapter = AppState.activeSession.currentChapter;
        const currentFullVolume = AppState.activeSession.loadedVolume;

        desiredChapter = currentFullVolume.chapters.find(chapter => chapter.chapterNumber === currentChapter);
        if (desiredChapter == undefined) desiredChapter = currentFullVolume.chapters[0];

        AppState.activeSession.currentChapter = desiredChapter.chapterNumber;
        updateSaveData();
        chapterData = desiredChapter.content;
    } else {
        desiredChapter = AppState.activeSession.loadedArtBook.chapters[0];
        chapterData = desiredChapter.content;
    }

    if (AppState.activeSession.isArtBook) {
        chapterContainer.classList.replace("active", "hidden");
        gallryWrapper.classList.replace("hidden", "active");
        const galleryGrid = document.getElementById("galleryGrid");
        galleryGrid.innerHTML = "";

        AppState.activeSession.loadedArtBook.chapters[0].content.forEach(imagePath => {
            const img = document.createElement("img");
            img.src = imagePath;
            img.className = "generic-gallery-item";
            img.addEventListener("pointerup", () => openGenericLightbox(imagePath));
            galleryGrid.appendChild(img);
        });

        const msnry = new Masonry(galleryGrid, {
            itemSelector: '.generic-gallery-item',
            columnWidth: 55, gutter: 10, fitWidth: true, transitionDuration: '0.2s'
        });

        document.querySelectorAll('.generic-gallery-item').forEach(img => {
            img.onload = () => msnry.layout(); 
        });
    } else {
        chapterContainer.classList.replace("hidden", "active");
        gallryWrapper.classList.replace("active", "hidden");
        chapterData.forEach(paragraph =>{
            const newParagraph = document.createElement("p");
            newParagraph.textContent = paragraph;
            chapterContainer.appendChild(newParagraph);
        });
        getSaveData(AppState.activeSession.currentNovel);
        chapterContainer.scrollTop = AppState.activeSession.currentScroll;
    }
}

// ========================================================================== //
// 6. TOP LEVEL MENU (TLM) CORE PIPELINE
// ========================================================================== //

async function tlmButtonInit(){
    let isPointerDown = false, isDragging = false, startX = 0, startY = 0, clickOffsetX = 0, clickOffsetY = 0;
    const tlmButton = document.getElementById("b_mainTLM");

    getSavedPos(); updateSavedPos(); getSavedPos();
    if (AppState.storedData.buttonPositionX !== null && AppState.storedData.buttonPositionY !== null) {
        tlmButton.style.left = AppState.storedData.buttonPositionX;
        tlmButton.style.top = AppState.storedData.buttonPositionY;
    }

    tlmButton.addEventListener("pointerdown", (e) => {
        isPointerDown = true; isDragging = false;
        startX = e.clientX; startY = e.clientY;
        const rect = tlmButton.getBoundingClientRect();
        clickOffsetX = e.clientX - rect.left;
        clickOffsetY = e.clientY - rect.top;
        tlmButton.setPointerCapture(e.pointerId);
        tlmButton.style.opacity = "100%";
        setTimeout(() => { tlmButton.style.opacity = "50%"; }, 2000);
    });

    tlmButton.addEventListener("pointermove", (e) => {
        if (!isPointerDown) return;
        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) isDragging = true;

        if (isDragging) {
            let newLeft = Math.max(0, Math.min(e.clientX - clickOffsetX, window.innerWidth - tlmButton.offsetWidth));
            let newTop = Math.max(0, Math.min(e.clientY - clickOffsetY, window.innerHeight - tlmButton.offsetHeight));
            updateSavedPos(newLeft, newTop);
            tlmButton.style.left = newLeft + "px";
            tlmButton.style.top = newTop + "px";
            AppState.activeSession.currentButtonPositionX = newLeft + "px";
            AppState.activeSession.currentButtonPositionY = newTop + "px";
            updateSavedPos();
            saveToLocalStorage(AppState.storedData);
        }
    });

    tlmButton.addEventListener("pointerup", (e) => {
        tlmButton.releasePointerCapture(e.pointerId);
        if (!isDragging) openTLM("mainTLM", tlmButton);
    });
}

function tlmOverlayInit(){
    document.getElementById("overlayContainer").addEventListener("pointerup", (e) => {
        const activeTLM = document.getElementById(AppState.activeSession.activeTLM);
        if (activeTLM && activeTLM.contains(e.target)) return;
        closeTLM("none");
    });
}

function openTLM(tlmID, buttonElement) {
    const targetTLM = document.getElementById(tlmID);
    const overlayContainer = document.getElementById("overlayContainer");

    AppState.activeSession.activeTLM = tlmID;
    AppState.activeSession.triggeringButton = buttonElement;

    overlayContainer.classList.replace("hidden", "active");
    targetTLM.classList.replace("hidden", "active");

    if (tlmID == "mainTLM") {
        buildMainTLM();
        document.documentElement.style.setProperty('--tlm-top', 'auto');
        document.documentElement.style.setProperty('--tlm-bottom', 'auto');
        document.documentElement.style.setProperty('--tlm-left', 'auto');
        document.documentElement.style.setProperty('--tlm-right', 'auto');
        document.documentElement.style.setProperty('--tlm-transform-origin', '');

        targetTLM.style.visibility = "hidden";
        targetTLM.classList.add("tlmOpen");

        const buttonRect = buttonElement.getBoundingClientRect();
        const popupRect = targetTLM.getBoundingClientRect();

        targetTLM.classList.remove("tlmOpen");
        targetTLM.style.visibility = "";

        const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
        const buttonCenterY = buttonRect.top + (buttonRect.height / 2);
        const menuLeft = (window.innerWidth / 2) - (popupRect.width / 2);
        let menuTop = (buttonCenterY < window.innerHeight / 2) ? buttonRect.bottom + 10 : buttonRect.top - popupRect.height - 10;

        document.documentElement.style.setProperty('--tlm-left', menuLeft + "px");
        document.documentElement.style.setProperty('--tlm-top', menuTop + "px");
        document.documentElement.style.setProperty('--tlm-transform-origin', `${buttonCenterX - menuLeft}px ${buttonCenterY - menuTop}px`);

        setTimeout(() => targetTLM.classList.add("tlmOpen"), 50); 
        buttonElement.classList.replace("active", "hidden");
    } else {
        targetTLM.classList.add("tlmOpen");
    }
}

function closeTLM(newTLM){
    if (!AppState.activeSession.activeTLM) return;
    const overlayContainer = document.getElementById("overlayContainer");

    if (newTLM == "none") {
        const targetTLM = document.getElementById(AppState.activeSession.activeTLM);
        const triggerButton = AppState.activeSession.triggeringButton;
        targetTLM.classList.remove("tlmOpen");

        setTimeout(() => {
            targetTLM.classList.replace("active", "hidden");
            overlayContainer.classList.replace("active", "hidden");
            if (triggerButton) triggerButton.classList.replace("hidden", "active");
            AppState.activeSession.activeTLM = null;
            AppState.activeSession.triggeringButton = null;
        }, 150);
    } else {
        const targetTLM = document.getElementById(newTLM);
        const oldTLM = document.getElementById(AppState.activeSession.activeTLM);
        oldTLM.classList.replace("active", "hidden");
        oldTLM.classList.remove("tlmOpen");
        targetTLM.classList.add("tlmOpen");
        targetTLM.classList.replace("hidden", "active");
        AppState.activeSession.activeTLM = newTLM;
    }
}

// ========================================================================== //
// 7. TLM SUB-MENUS & LOGIC HOOKS
// ========================================================================== //

function mainTLMInit(){
    document.getElementById("b_returnMainMenu").addEventListener("pointerup", () => returnToVolume());
    document.getElementById("b_settings").addEventListener("pointerup", (e) => { e.stopPropagation(); });
    document.getElementById("b_previousChap").addEventListener("pointerup", () => { switchChapter("previous"); closeTLM("none"); });
    document.getElementById("b_selectChap").addEventListener("pointerup", (e) => { e.stopPropagation(); chooseChapter(); });
    document.getElementById("b_nextChap").addEventListener("pointerup", () => { switchChapter("next"); closeTLM("none"); });
}

function buildMainTLM(){
    const novelName = AppState.activeSession.currentNovel;
    const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
    const currentVolumeObj = currentNovelObj.volumes.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
    
    document.getElementById("tlmHeader").innerHTML = `<b>${novelName}</b>`;
    document.getElementById("tlmH2Volume").innerHTML = "<b>Volume: </b>" + currentVolumeObj.volumeTitle;
    document.getElementById("tlmH2Chapter").innerHTML = "<b>Chapter: </b>" + AppState.activeSession.currentChapter;
}

function chooseChapTLMInit(){
    document.getElementById("b_chapterBack").addEventListener("pointerup", (e) => { e.stopPropagation(); closeTLM("mainTLM"); });
}

async function chooseChapter(){
    await buildChapterSelect();
    closeTLM("chapterSelect");
}

async function buildChapterSelect(){
    const choiceContainer = document.getElementById("chapterChoiceContainer");
    choiceContainer.innerHTML = "";

    const novelObj = AppState.library.find(series => series.seriesName === AppState.activeSession.currentNovel);
    const volumeObj = novelObj.volumes.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
    let startingChap = 1;

    for (let v = 1; v < volumeObj.volumeNumber; v++) {
        const pastVolume = novelObj.volumes.find(vol => vol.volumeNumber === v);
        if (pastVolume) startingChap += pastVolume.totalChapters;
    }

    for (let i = startingChap; i <= startingChap + volumeObj.totalChapters - 1; i++) {
        const chapterChoice = document.createElement("div");
        chapterChoice.id = i.toString();
        chapterChoice.classList.add("colorChoice");

        const chapterText = document.createElement("div");
        chapterText.classList.add("colorText");
        chapterText.innerHTML = "Chapter: " + i;

        chapterChoice.appendChild(chapterText);
        if (chapterChoice.id == AppState.activeSession.currentChapter.toString()) chapterChoice.classList.add("selectedColor");

        chapterChoice.addEventListener("pointerup", () => {
            AppState.activeSession.currentChapter = i;
            updateSaveData();
            closeTLM("none");
            openReader();
        });
        choiceContainer.appendChild(chapterChoice);
    }
}

// ========================================================================== //
// 8. UTILITIES, FORMATTING, & HELPERS
// ========================================================================== //

function openGenericLightbox(imagePath) {
    const overlay = document.getElementById("generic-lightbox-overlay");
    document.getElementById("generic-lightbox-text").innerHTML = formatArtTitle(imagePath);
    document.getElementById("generic-lightbox-image").src = imagePath;
    overlay.classList.replace("hidden", "active");
}

function closeGenericLightbox() {
    document.getElementById("generic-lightbox-overlay").classList.replace("active", "hidden");
}

function switchChapter(direction){
    const novelName = AppState.activeSession.currentNovel;
    const volumesList = AppState.library.find(series => series.seriesName === novelName).volumes;
    const volumeNumber = volumesList.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume).volumeNumber;

    if (direction == "next"){
        if (AppState.activeSession.loadedVolume.chapters.find(chapter => chapter.chapterNumber === AppState.activeSession.currentChapter + 1) != undefined){
            AppState.activeSession.currentChapter += 1;
            updateSaveData(); buildMainTLM(); buildReader();
        } else if (volumeNumber < volumesList.length){
            AppState.activeSession.currentChapter += 1;
            AppState.activeSession.currentVolume += 1;
            updateSaveData(); buildMainTLM(); openReader();
        }
    } else if (direction == "previous"){
        if (AppState.activeSession.loadedVolume.chapters.find(chapter => chapter.chapterNumber === AppState.activeSession.currentChapter - 1) != undefined){
            AppState.activeSession.currentChapter -= 1;
            updateSaveData(); buildMainTLM(); buildReader();
        } else if (volumeNumber > 0){
            AppState.activeSession.currentChapter -= 1;
            AppState.activeSession.currentVolume -= 1;
            updateSaveData(); buildMainTLM(); openReader();
        }
    }
}

function formatVolumeName(rawText) { return rawText.toLowerCase().replace(/\s+/g, '-'); }
function formatSeriesName(rawText) { return rawText.replace(/\s+/g, '-'); }
function formatArtTitle(rawFilePath) { return rawFilePath.split('/').pop().split('.')[0].replace(/-/g, ' '); }

function applyCoverWithFallbacks(targetHtmlElement, seriesName, volumeNumber) {
    const safeSeriesStringPic = formatVolumeName(seriesName);
    const safeSeriesString = formatSeriesName(seriesName);
    const specificBookFile = `${safeSeriesStringPic}-${volumeNumber}`;

    const targetPaths = [
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.png`,
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.jpg`,
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.webp`,
        `Images/Novel-Covers/${safeSeriesString}.png`,
        `Images/Novel-Covers/${safeSeriesString}.jpg`
    ];

    function tryLoadingImage(pathsArray) {
        if (pathsArray.length === 0) return; 
        const testerImage = new Image();
        testerImage.onload = () => {
            targetHtmlElement.style.backgroundImage = `url('${pathsArray[0]}')`;
            targetHtmlElement.style.backgroundSize = "cover";
            targetHtmlElement.style.backgroundPosition = "center";
        };
        testerImage.onerror = () => tryLoadingImage(pathsArray.slice(1));
        testerImage.src = pathsArray[0];
    }
    tryLoadingImage(targetPaths);
}

// Stubs for Settings
function settingsTLMInit(){}
function textColorTLMInit(){}
function bgColorTLMInit(){}

// Execute
main();