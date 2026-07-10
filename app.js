// ========================================================================== //
// 1. GLOBAL STATE & CONFIGURATION
// ========================================================================== //

const AppState = {
    library: {},
    activeSession: {
        currentNovel: null, 
        currentVolume: null, 
        currentChapter: null, 
        currentScroll: null,
        
        loadedVolume: null, 
        loadedArtBook: null,

        activeMenu: null, 
        activeTLM: null, 
        triggeringButton: null,

        currentButtonPositionX: null, 
        currentButtonPositionY: null,

        isArtBook: null,

        settings: {},

        isDownloadMode: false,

        currentArtIndex: 0,
        artChunkSize: 20
    },
    storedData: {
        lastNovel: null, novelSaves: {},
        buttonPositionX: null, buttonPositionY: null,
        settings: {}
    },
    defaultSettings: {
            displayStats: true,
            textColor: "white", 
            bgColor: "black", 
            fontSize: 30, 
            font: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
            bgColorList: ["black", "white", "blue", "yellow", "green", "red", "grey", "pink", "purple", "#2b2d31", "rgb(5, 0, 148)", "#4D22B2", "#371A94", "#2C0977", "#1A0A52", "#2E063D"], 
            textColorList: ["black", "white", "blue", "yellow", "green", "red", "grey", "pink", "purple", "#2b2d31", "rgb(5, 0, 148)", "#4D22B2", "#371A94", "#2C0977", "#1A0A52", "#2E063D"] 
    }
};

const viewList = ["mainMenu", "volumeMenu", "reader"];
const tlmList = ["mainTLM", "chapterSelect", "settings", "colorListText", "colorListBG", "fontList"];
const STORAGE_KEY = "novelReader_offlineSaveData";
const fontMap = new Map();
fontMap.set("Default", "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif");
fontMap.set("Georgia", "Georgia, serif");
fontMap.set("Time New Roman", "\"Times New Roman\", Times, serif");
fontMap.set("Palatino", "\"Palatino Linotype\", \"Book Antiqua\", Palatino, serif");
fontMap.set("Ariel", "Arial, Helvetica, sans-serif");
fontMap.set("Verdana", "Verdana, Geneva, sans-serif");
fontMap.set("Trebuchet MS", "\"Trebuchet MS\", Helvetica, sans-serif");
fontMap.set("Courier", "\"Courier New\", Courier, monospace");
fontMap.set("Ariel Black", "\"Arial Black\", Gadget, sans-serif");
fontMap.set("Impact", "Impact, Haettenschweiler, \"Arial Narrow Bold\", sans-serif");
fontMap.set("Avenir", "\"Avenir Next\", Avenir, \"Helvetica Neue\", Helvetica, Arial, sans-serif");
fontMap.set("Baskerville", "Baskerville, \"Baskerville Old Face\", \"Hoefler Text\", Garamond, \"Times New Roman\", serif");
fontMap.set("Garamond", "Garamond, \"Apple Garamond\", \"Palatino Linotype\", Palatino, serif");
fontMap.set("Consolas", "Consolas, Monaco, \"Andale Mono\", \"Ubuntu Mono\", monospace");
fontMap.set("Rockwell", "Rockwell, \"Courier Bold\", Courier, Georgia, Times, \"Times New Roman\", serif");


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
    fontTLMInit();
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

function getSavedSettings(){
    if (Object.keys(AppState.storedData.settings).length > 0) {
        AppState.activeSession.settings = AppState.storedData.settings;
    } else {
        AppState.activeSession.settings = AppState.defaultSettings;
    }
}

function updateSavedSettings(){
    AppState.storedData.settings = AppState.activeSession.settings;
}

async function isVolumeDownloaded(desiredURL){
    const cache = await caches.open("volume-downloads-v7");
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
    if (window.currentObserver && targetViewId != "reader") {
        window.currentObserver.disconnect();
    }
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
        AppState.activeSession.currentArtIndex = 0;
        chapterContainer.classList.replace("active", "hidden");
        gallryWrapper.classList.replace("hidden", "active");
        const galleryGrid = document.getElementById("galleryGrid");
        galleryGrid.innerHTML = "";
        const tripWire = document.getElementById("generic-scroll-trigger");

        const fullStringArray = AppState.activeSession.loadedArtBook.chapters[0].content;

        /*
        AppState.activeSession.loadedArtBook.chapters[0].content.forEach(imagePath => {
            const img = document.createElement("img");
            img.src = imagePath;
            img.className = "generic-gallery-item";
            img.addEventListener("pointerup", () => openGenericLightbox(imagePath));
            galleryGrid.appendChild(img);
        });*/

        const msnry = new Masonry(galleryGrid, {
            itemSelector: '.generic-gallery-item',
            columnWidth: '.generic-gallery-item', gutter: 10, fitWidth: true, transitionDuration: '0.2s'
        });

        let layoutTimer;

        function renderImageChunk() {
            // 1. Slice out just the next 20 images
            let currentArtIndex = AppState.activeSession.currentArtIndex;
            const artChunkSize = AppState.activeSession.artChunkSize;
            const nextBatch = fullStringArray.slice(currentArtIndex, currentArtIndex + artChunkSize);
            
            // 2. Loop through the slice, create elements, and append them
            nextBatch.forEach(imagePath => {
                const img = document.createElement("img");
                img.src = imagePath;
                img.className = "generic-gallery-item";
                img.addEventListener("pointerup", () => openGenericLightbox(imagePath));
                galleryGrid.appendChild(img);
                
                // 2. Tell Masonry it exists IMMEDIATELY (so the container grows and pushes the tripwire down)
                msnry.appended(img);
                
                img.onload = () => {
                    clearTimeout(layoutTimer);

                    layoutTimer = setTimeout( () => {
                        msnry.layout();
                    }, 100);

                };
            });

            // 3. Move the index forward for the next time this runs
            AppState.activeSession.currentArtIndex += artChunkSize;
            
            // 4. Force a layout update for the new batch
            msnry.layout();
        }

        renderImageChunk();

        if (window.currentObserver) {
            window.currentObserver.disconnect();
        }

        window.currentObserver = new IntersectionObserver((entries) => {
            // If the tripwire enters the screen...
            if (entries[0].isIntersecting && AppState.activeSession.currentArtIndex < fullStringArray.length) {
                renderImageChunk();
            }
        }, {
            root: document.getElementById("galleryWrapper"), // Forces math to calculate inside this specific div
            rootMargin: "200px"
        });

        window.currentObserver.observe(tripWire);

    } else {
        chapterContainer.classList.replace("hidden", "active");
        gallryWrapper.classList.replace("active", "hidden");
        if (AppState.activeSession.settings.displayStats){
            const wordCount = chapterData.reduce((count, paragraph) => {
                const words = paragraph.trim().split(/\s+/);
                return count + (words[0] === "" ? 0 : words.length);
                }, 0);
            const statsHeaderSeries = document.createElement("h1");
            statsHeaderSeries.innerHTML = `<B>${AppState.activeSession.currentNovel}</B>`
            const statsHeaderChap = document.createElement("h3");
            statsHeaderChap.innerHTML = `<B>Chapter: </B>${AppState.activeSession.currentChapter} \n<B>Words: </B>${wordCount} `;
            chapterContainer.appendChild(statsHeaderSeries);
            chapterContainer.appendChild(statsHeaderChap);
        }
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
    document.getElementById("b_settings").addEventListener("pointerup", (e) => { e.stopPropagation(); openSettings()});
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

function settingsTLMInit(){
    getSavedSettings();
    document.documentElement.style.setProperty('--active-reader-font-size', AppState.activeSession.settings.fontSize + "px");
    document.documentElement.style.setProperty('--active-reader-font', AppState.activeSession.settings.font);
    document.documentElement.style.setProperty('--active-reader-text-color', AppState.activeSession.settings.textColor);
    document.documentElement.style.setProperty('--active-reader-bg-color', AppState.activeSession.settings.bgColor);
}

function openSettings(){
    buildSettings();
    closeTLM("settings");
}

function buildSettings(){
    const settingsContainer = document.getElementById("settings");
    settingsContainer.innerHTML = "";

    const fontSizeContainer = document.createElement("div");
    fontSizeContainer.id = "fontSizeContainer";

    const fontSlider = document.createElement("input");
    fontSlider.id = "fontSlider";
    fontSlider.type = "range";
    fontSlider.min = 1;
    fontSlider.max = 99;
    fontSlider.value = AppState.activeSession.settings.fontSize;

    const fontInput = document.createElement("input");
    fontInput.id = "fontInput";
    fontInput.type = "number";
    fontInput.min = 1;
    fontInput.max = 99;
    fontInput.value = AppState.activeSession.settings.fontSize;

    fontSlider.addEventListener("input", (e) => {
        const newValue = e.target.value;
        fontInput.value = newValue;
        document.documentElement.style.setProperty('--active-reader-font-size', newValue + "px");
    });

    fontSlider.addEventListener("change", (e) => {
        AppState.activeSession.settings.fontSize = e.target.value;
        updateSavedSettings();
        updateSaveData();
    });

    fontInput.addEventListener("input", (e) => {
        const newValue = e.target.value;
        if (newValue >= 1 && newValue <= 99){
            fontSlider.value = newValue;
            document.documentElement.style.setProperty('--active-reader-font-size', newValue + "px");
        }
    });

    fontInput.addEventListener("change", (e) => {
        AppState.activeSession.settings.fontSize = e.target.value;
        updateSavedSettings();
        updateSaveData();
    });

    fontSizeContainer.appendChild(fontSlider);
    fontSizeContainer.appendChild(fontInput);

    const bgColorSelectButton = document.createElement("button");
    bgColorSelectButton.id = "b_colorBG";
    bgColorSelectButton.classList.add("b_settingsInner");
    bgColorSelectButton.innerHTML = " Background Color";
    bgColorSelectButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        openBGColor();
    });

    const txtColorSelectButton = document.createElement("button");
    txtColorSelectButton.id = "b_colorFont";
    txtColorSelectButton.classList.add("b_settingsInner");
    txtColorSelectButton.innerHTML = " Font Color";
    txtColorSelectButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        openTXTColor();
    }); 

    const fontChoiceButton = document.createElement("button");
    fontChoiceButton.id = "b_font";
    fontChoiceButton.classList.add("b_settingsInner");
    fontChoiceButton.innerHTML = " Font";
    fontChoiceButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        openFontSelect();
    }); 
    
    const statsToggleButton = document.createElement("button");
    statsToggleButton.id = "b_stats";
    statsToggleButton.classList.add("b_settingsInner");
    statsToggleButton.innerHTML = " Info Header";
    if (AppState.activeSession.settings.displayStats == true) statsToggleButton.classList.add("selectedColor");
    statsToggleButton.addEventListener("pointerup", () => {
        AppState.activeSession.settings.displayStats = !AppState.activeSession.settings.displayStats;
        if (AppState.activeSession.settings.displayStats == true){ 
            statsToggleButton.classList.add("selectedColor");
        } else {
            statsToggleButton.classList.remove("selectedColor")
        }
        updateSavedSettings();
        updateSaveData();
        buildReader();
    });   

    const resetDefaultsButton = document.createElement("button");
    resetDefaultsButton.id = "b_resetDefaults";
    resetDefaultsButton.classList.add("b_settingsInner");
    resetDefaultsButton.innerHTML = " Reset Defaults";
    resetDefaultsButton.addEventListener("pointerup", () => {
        AppState.activeSession.settings = structuredClone(AppState.defaultSettings);
        document.documentElement.style.setProperty('--active-reader-font-size', AppState.activeSession.settings.fontSize + "px");
        document.documentElement.style.setProperty('--active-reader-font', AppState.activeSession.settings.font);
        document.documentElement.style.setProperty('--active-reader-text-color', AppState.activeSession.settings.textColor);
        document.documentElement.style.setProperty('--active-reader-bg-color', AppState.activeSession.settings.bgColor);
        updateSavedSettings();
        updateSaveData();
        if (AppState.activeSession.settings.displayStats == true) statsToggleButton.classList.add("selectedColor");
        fontInput.value = AppState.activeSession.settings.fontSize;
        fontSlider.value = AppState.activeSession.settings.fontSize;
        buildReader();
    });
    
    settingsContainer.appendChild(fontSizeContainer);
    settingsContainer.appendChild(bgColorSelectButton);
    settingsContainer.appendChild(txtColorSelectButton);
    settingsContainer.appendChild(fontChoiceButton);    
    settingsContainer.appendChild(statsToggleButton);
    settingsContainer.appendChild(resetDefaultsButton);
}

function textColorTLMInit(){
    const backButton = document.getElementById("b_colorBackText");
    backButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        closeTLM("settings");
    });
}

function openTXTColor(){
    buildTXTColor();
    closeTLM("colorListText");
}
function buildTXTColor(){
    const choiceContainer = document.getElementById("colorChoicesContainerText");
    choiceContainer.innerHTML = "";

    AppState.activeSession.settings.textColorList.forEach(color => {
        const colorChoiceContainr = document.createElement("div");
        colorChoiceContainr.classList.add("colorChoicesContainerText");
        colorChoiceContainr.classList.add("colorChoice");
        colorChoiceContainr.id = color;

        const colorText = document.createElement("div");
        colorText.classList.add("colorText");
        colorText.innerHTML = color;

        const colorExample = document.createElement("div");
        colorExample.classList.add("colorExample");
        colorExample.style.borderColor = color;

        colorChoiceContainr.appendChild(colorText);
        colorChoiceContainr.appendChild(colorExample);

        if (color == AppState.activeSession.settings.textColor) colorChoiceContainr.classList.add("selectedColor");

        colorChoiceContainr.addEventListener("pointerup", () => {
            AppState.activeSession.settings.textColor = color;
            document.documentElement.style.setProperty('--active-reader-text-color', color);
            updateSavedSettings();
            updateSaveData();
            try {
                colorChoiceContainr.querySelector(".colorChoice.selectedColor").classList.remove("selectedColor");
            } catch (error) {
                console.log(error);
            }   
            colorChoiceContainr.classList.add("selectedColor");
        });

        choiceContainer.appendChild(colorChoiceContainr);
    });
}

function bgColorTLMInit(){
    const backButton = document.getElementById("b_colorBackBG");
    backButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        closeTLM("settings");
    });
}

function openBGColor(){
    buildBGColor();
    closeTLM("colorListBG");
}
function buildBGColor(){
    const choiceContainer = document.getElementById("colorChoicesContainerBG");
    choiceContainer.innerHTML = "";

    AppState.activeSession.settings.bgColorList.forEach(color => {
        const colorChoiceContainr = document.createElement("div");
        colorChoiceContainr.classList.add("colorChoicesContainerBG");
        colorChoiceContainr.classList.add("colorChoice");
        colorChoiceContainr.id = color;

        const colorText = document.createElement("div");
        colorText.classList.add("colorText");
        colorText.innerHTML = color;

        const colorExample = document.createElement("div");
        colorExample.classList.add("colorExample");
        colorExample.style.borderColor = color;

        colorChoiceContainr.appendChild(colorText);
        colorChoiceContainr.appendChild(colorExample);

        if (color == AppState.activeSession.settings.bgColor) colorChoiceContainr.classList.add("selectedColor");

        colorChoiceContainr.addEventListener("pointerup", () => {
            AppState.activeSession.settings.bgColor = color;
            document.documentElement.style.setProperty('--active-reader-bg-color', color);
            updateSavedSettings();
            updateSaveData();
            try {
                choiceContainer.querySelector(".colorChoice.selectedColor").classList.remove("selectedColor");
            } catch (error) {
                console.log(error);
            }              
            colorChoiceContainr.classList.add("selectedColor");
        });

        choiceContainer.appendChild(colorChoiceContainr);
    });
}

function fontTLMInit(){
    const backButton = document.getElementById("b_fontBack");
    backButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        closeTLM("settings");
    });
}
function openFontSelect(){
    buildFontSelect();
    closeTLM("fontList")
}
function buildFontSelect(){
    const fontChoicesContainer = document.getElementById("fontChoicesContainer");
    fontChoicesContainer.innerHTML = "";
    fontMap.forEach((value, key) => {
        const fontChoice = document.createElement("div");
        fontChoice.classList.add("colorChoice");
        const fontName = document.createElement("div");
        fontName.classList.add("colorText");
        fontName.style.fontFamily = value;
        fontName.innerHTML = key;
        fontChoice.appendChild(fontName);
        if (value == AppState.activeSession.settings.font) fontChoice.classList.add("selectedColor");
        fontChoice.addEventListener("pointerup", () => {
            AppState.activeSession.settings.font = value;
            updateSavedSettings();
            updateSaveData();
            document.documentElement.style.setProperty('--active-reader-font', value)
            try {
                fontChoicesContainer.querySelector(".colorChoice.selectedColor").classList.remove("selectedColor");
            } catch (error) {
                console.log(error);
            }
            fontChoice.classList.add("selectedColor")
        });
        fontChoicesContainer.appendChild(fontChoice);
    });
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


// Execute
main();