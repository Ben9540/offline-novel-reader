
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

        settings: {
            currentTextColor: null,
            currentBgColor: null,
            currentFontSize: null,
            currentFont: null,
            currentBgColorList: [],
            currentTextColorList: []
        },
        isDownloadMode: false
    },

    storedData: {
        lastNovel: null,
        novelSaves: {},

        buttonPositionX: null,
        buttonPositionY: null,

        settings: {
            textColor: null,
            bgColor: null,
            fontSize: null,
            font: null,
            bgColorList: [],
            textColorList: []
        }
    }
}

const viewList = ["mainMenu", "volumeMenu", "reader"];
const tlmList = ["mainTLM", "chapterSelect", "settings", "colorListText", "colorListBG"];


// ========================================================================== //
// 2. INITIALIZATION
// ========================================================================== //

async function main(){
    registerServiceWorker();
    getFromLocalStorage();
    await allTLMInit();
    readerInit();
    await loadLibraryIndex();
    volumeMenuInit();
}

function mainMenuInit(){}

function volumeMenuInit(){
    const backButton = document.getElementById("b_backFloat");
    const downloadButton = document.getElementById("b_volumeDownload");

    downloadButton.addEventListener("pointerup", () => {
        toggleDownloadMode();
    });

    backButton.addEventListener("pointerup", () => {
        viewSwitcher("mainMenu");
    });
}

async function allTLMInit(){
    await tlmButtonInit();
    tlmOverlayInit();
    mainTLMInit();
    settingsTLMInit();
    chooseChapTLMInit();
    textColorTLMInit();
    bgColorTLMInit();
}

function readerInit(){
    // Allow clicking the background to close it
    document.getElementById("generic-lightbox-overlay").addEventListener("pointerup", (e) => {
        // Prevents the menu from closing if they accidentally tap the image itself
        if (e.target.id !== "generic-lightbox-image") {
            closeGenericLightbox();
        }
    });
}

async function toggleDownloadMode() {
    AppState.activeSession.isDownloadMode = !AppState.activeSession.isDownloadMode;
    
    const pillContainer = document.getElementById("volumeButtonContainer");
    const allVolumeElements = document.querySelectorAll(".volumeBookCover");

    pillContainer.innerHTML = "";

    if (AppState.activeSession.isDownloadMode) {
        // 1. Update the pill UI to hide search/download
        const backButton = document.createElement("button");
        backButton.id = "b_backFloat";
        backButton.innerHTML = "Back";

        backButton.addEventListener("pointerup", () => {
            toggleDownloadMode();
        });

        pillContainer.appendChild(backButton);

        // 2. Loop through every rendered item and check its offline status
        for (let item of allVolumeElements) {
            // Assume you stored the target URL as an attribute on the HTML element
            const fileUrl = item.getAttribute("data-file-url"); 
            const isSaved = await isVolumeDownloaded(fileUrl);
            
            if (isSaved) {
                item.classList.add("status-downloaded");
            } else {
                item.classList.add("status-missing");
            }
        }
    } else {
        // 1. Restore the pill UI
        const backButton = document.createElement("button");
        backButton.id = "b_backFloat";
        backButton.innerHTML = "Back";
        backButton.addEventListener("pointerup", () => {
            viewSwitcher("mainMenu");
        });

        const downloadButton = document.createElement("button");
        downloadButton.id = "b_volumeDownload";
        downloadButton.classList.add("b_download");
        downloadButton.innerHTML = "Download";
        downloadButton.addEventListener("pointerup", () => {
            toggleDownloadMode();
        });

        const searchButton = document.createElement("button");
        searchButton.id = "volumeSearch";
        searchButton.classList.add("b_search");
        searchButton.innerHTML = "Search";
        searchButton.addEventListener("pointerup", () => {
            //searchVolumes();
        });

        pillContainer.appendChild(backButton);
        pillContainer.appendChild(downloadButton);
        pillContainer.appendChild(searchButton);
        
        // 2. Wipe the red/green classes so it looks normal again
        allVolumeElements.forEach(item => {
            item.classList.remove("status-downloaded", "status-missing");
        });
    }
}

async function tlmButtonInit(){
    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let clickOffsetX = 0;
    let clickOffsetY = 0;

    const tlmButton = document.getElementById("b_mainTLM");

    getSavedPos();
    updateSavedPos();
    getSavedPos();

    const savedX = AppState.storedData.buttonPositionX;
    const savedY = AppState.storedData.buttonPositionY;

    // Explicitly paint the element using inline CSS
    if (savedX !== null && savedY !== null) {
        tlmButton.style.left = savedX;
        tlmButton.style.top = savedY;
    }

    tlmButton.addEventListener("pointerdown", (e) => {
        isPointerDown = true;
        isDragging = false;
        
        startX = e.clientX;
        startY = e.clientY;

        // 1. Grab the bounding box ONLY ONCE on initial click
        const rect = tlmButton.getBoundingClientRect();
        
        // 2. Calculate the anchor point (Mouse Position minus Button Edge)
        clickOffsetX = e.clientX - rect.left;
        clickOffsetY = e.clientY - rect.top;
        
        tlmButton.setPointerCapture(e.pointerId);

        tlmButton.style.opacity = "100%";

        setTimeout(() => {
            tlmButton.style.opacity = "50%"
        }, 2000);
    });

    tlmButton.addEventListener("pointermove", (e) => {
        if (!isPointerDown) return;

        // Check if dragging started
        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
        }

        if (isDragging) {
            // 3. The magic formula: Mouse position minus the initial anchor offset!
            // No delta math, no lastMouseX, no bounding box recalculations!
            let newLeft = e.clientX - clickOffsetX;
            let newTop = e.clientY - clickOffsetY;

            // 4. Get dimensions for the boundaries
            // (We use offsetWidth/Height here because bounding rect can be distorted by transforms)
            const maxX = window.innerWidth - tlmButton.offsetWidth;
            const maxY = window.innerHeight - tlmButton.offsetHeight;
            
            // 5. Clamp to screen
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            updateSavedPos(newLeft, newTop);

            // 6. Apply
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
        
        if (!isDragging) {
            console.log("This was a pure tap! Open the menu.");
            openTLM("mainTLM", tlmButton);
        } else {
            console.log("This was a drag! Do not open menu.");
            // Optional: Add logic here to snap the button to the edge of the screen
        }
    });
}

function tlmOverlayInit(){
    const overlayContainer = document.getElementById("overlayContainer");

    overlayContainer.addEventListener("pointerup", (e) => {
        const activeTLM = document.getElementById(AppState.activeSession.activeTLM);

        if (activeTLM && activeTLM.contains(e.target)) return;
            closeTLM("none");
        });
}

function mainTLMInit(){
    const tlmVolumeButton = document.getElementById("b_returnMainMenu");
    const tlmSettingsButton = document.getElementById("b_settings");
    const tlmPrevChapButton = document.getElementById("b_previousChap");
    const tlmChooseChapButton = document.getElementById("b_selectChap");
    const tlmNextChapButton = document.getElementById("b_nextChap");

    tlmVolumeButton.addEventListener("pointerup", () => {
        returnToVolume();
    });
    tlmSettingsButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        //openSettings();
    });
    tlmPrevChapButton.addEventListener("pointerup", () => {
        switchChapter("previous");
        closeTLM("none");
    });
    tlmChooseChapButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        chooseChapter();
    });
    tlmNextChapButton.addEventListener("pointerup", () => {
        switchChapter("next");
        closeTLM("none");
    });
}

function settingsTLMInit(){

}

function chooseChapTLMInit(){
    const backButton = document.getElementById("b_chapterBack");

    backButton.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        closeTLM("mainTLM");
    });
}

function textColorTLMInit(){
}

function bgColorTLMInit(){
}

async function loadLibraryIndex() {
    try {
        const response = await fetch('Novel-Library/index.json');
        
        const indexData = await response.json();
        
        AppState.library = indexData;
        
        console.log("Library loaded successfully:", AppState.library);
        
        // Now that the data is loaded, we can tell the app to draw the Main Menu
        buildMainMenu(); 
        
    } catch (error) {
        console.error("Failed to load the index file. Is it in the right folder?", error);
    }
}


// ========================================================================== //
// 3. TLM (TOP-LEVEL MENU) MANAGEMENT
// ========================================================================== //

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
        document.documentElement.style.setProperty('--tlm-tranform-origin', '');

        targetTLM.style.visibility = "hidden";
        targetTLM.classList.add("tlmOpen");

        const buttonRect = buttonElement.getBoundingClientRect();
        const popupRect = targetTLM.getBoundingClientRect();
        console.log(popupRect.width, popupRect.height);

        targetTLM.classList.remove("tlmOpen");
        targetTLM.style.visibility = ""

        const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
        const buttonCenterY = buttonRect.top + (buttonRect.height / 2);

        const menuLeft = (window.innerWidth / 2) - (popupRect.width / 2);
        let menuTop;

        if (buttonCenterY < window.innerHeight / 2) {
            menuTop = buttonRect.bottom + 10; 
        } else {
            menuTop = buttonRect.top - popupRect.height - 10;
        }

        // Apply positions
        document.documentElement.style.setProperty('--tlm-left', menuLeft + "px");
        document.documentElement.style.setProperty('--tlm-top', menuTop + "px");

        const originX = buttonCenterX - menuLeft;
        const originY = buttonCenterY - menuTop;
        document.documentElement.style.setProperty('--tlm-transform-origin', `${originX}px ${originY}px`);

        setTimeout(() => {
            targetTLM.classList.add("tlmOpen");
        }, 50); 

        buttonElement.classList.replace("active", "hidden");
    } else {
        targetTLM.classList.add("tlmOpen");
    }
}

function buildMainTLM(){
    const tlmH1 = document.getElementById("tlmHeader");
    const tlmH2Volume = document.getElementById("tlmH2Volume");
    const tlmH2Chapter = document.getElementById("tlmH2Chapter");

    const novelName = AppState.activeSession.currentNovel;
    console.log(novelName);
    const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
    const volumesList = currentNovelObj.volumes;
    console.log("vl" + volumesList);
    console.log(AppState.activeSession.currentVolume);
    const currentVolumeObj = volumesList.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
    const volumeName = currentVolumeObj.volumeTitle;
    const chapterNumber = AppState.activeSession.currentChapter;

    tlmH1.innerHTML = `<B>${novelName}</B>`;
    tlmH2Volume.innerHTML = "<B>Volume: </B>" + volumeName;
    tlmH2Chapter.innerHTML = "<B>Chapter: </B>" + chapterNumber;
}

async function buildChapterSelect(){
    const choiceContainer = document.getElementById("chapterChoiceContainer");
    choiceContainer.innerHTML = "";

    const novelObj = AppState.library.find(series => series.seriesName === AppState.activeSession.currentNovel);
    const volumeObj = novelObj.volumes.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
    const totalChapters = volumeObj.totalChapters;
    let startingChap = 1;

    for (let v = 1; v < volumeObj.volumeNumber; v++) {
        const pastVolume = novelObj.volumes.find(vol => vol.volumeNumber === v);
        if (pastVolume) {
            startingChap += pastVolume.totalChapters;
        }
    }

    for (let i = startingChap; i <= startingChap + totalChapters - 1; i++) {
        const chapterChoice = document.createElement("div");
        chapterChoice.id = i.toString();
        chapterChoice.classList.add("colorChoice");

        const chapterText = document.createElement("div");
        chapterText.classList.add("colorText");
        chapterText.innerHTML = "Chapter: " + i;

        chapterChoice.appendChild(chapterText);

        if (chapterChoice.id == AppState.activeSession.currentChapter.toString()) {
            chapterChoice.classList.add("selectedColor");
        }

        chapterChoice.addEventListener("pointerup", () => {
            AppState.activeSession.currentChapter = i;
            updateSaveData();
            closeTLM("none");
            openReader();
        });

        choiceContainer.appendChild(chapterChoice);
    }
}

async function chooseChapter(){
    await buildChapterSelect();
    closeTLM("chapterSelect");
}

async function returnToVolume(){
    await buildVolumeMenu(AppState.activeSession.currentNovel);
    closeTLM("none");
    viewSwitcher("volumeMenu");
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
            
            if (triggerButton) {
                triggerButton.classList.replace("hidden", "active");
            }

            // Clear state
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
// 4. APP MENUS (MAIN MENU & VOLUME MENU)
// ========================================================================== //

async function buildMainMenu(){
    const novelMenuBooks = document.getElementById("mainMenuBooks");
    const novelMenuBar = document.getElementById("menuInfoBar");
    const searchButton = document.getElementById("menuSearch")

    novelMenuBooks.innerHTML = "";
    novelMenuBar.innerHTML = "";

    //SHOULD BE IN INIT NOT HERE SINCE THATS A LOT OF EVENT LISTENERS FOR THIS
    searchButton.addEventListener("pointerup", () => {
        //searchNovel();
    });

    const menuTopH = document.createElement("h1");
    menuTopH.classList.add("appTitle");
    menuTopH.innerHTML = "Ben's Novel Reader"

    const menuTopP = document.createElement("p");
    menuTopP.classList.add("currentSeriesText");
    if (AppState.storedData.lastNovel == null) {
        menuTopP.innerHTML = "Start Reading Something!"
    } else if (AppState.activeSession.currentNovel == null) {
        getSaveData(AppState.storedData.lastNovel);
        menuTopP.innerHTML = `<B> Last Novel: </B>${AppState.storedData.lastNovel} <B> Chapter: </B> ${AppState.activeSession.currentChapter}`;
    } else {
        menuTopP.innerHTML = `<B> Last Novel: </B>${AppState.storedData.lastNovel} <B> Chapter: </B> ${AppState.activeSession.currentChapter}`;
    }

    novelMenuBar.appendChild(menuTopH);
    novelMenuBar.appendChild(menuTopP);

    AppState.library.forEach(novelContainer => {
        let pressTimer;
        let wasHeld;

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
                console.log("This is a HOLD! Go to Volume Menu.");
                openVolumeMenu(novelName);
            }, 500); 
        });
        novelDivContainer.addEventListener("pointerup", () => {
            clearTimeout(pressTimer);
            AppState.activeSession.currentNovel = novelName;
            if (!wasHeld) {
                console.log("This is a TAP! Continue reading.");
                openReader();
            }
        });

        novelMenuBooks.appendChild(novelDivContainer);
    });
}

async function buildVolumeMenu(novelName){
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

    const volumesList = currentNovelObj.volumes;

    console.log(volumesList);

    volumesList.forEach(volume => {
        let pressTimer;
        let wasHeld;

        const volumeName = volume.volumeTitle;

        const volumeCamelCase = volumeName.trim().toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, m) => m.toUpperCase());

        const volumeDivContainer = document.createElement("div");
        volumeDivContainer.id = volumeCamelCase + "Button";
        volumeDivContainer.classList.add("bookAndTitle");

        const coverDiv = document.createElement("div");
        coverDiv.id = volumeCamelCase;
        coverDiv.classList.add("bookCover");
        coverDiv.classList.add("volumeBookCover");
        coverDiv.setAttribute("data-file-url", 'Novel-Library/' + volume.fileName);
        console.log("attribute: " + coverDiv.getAttribute("data-file-url"));
        coverDiv.style.backgroundImage = `url('${volume.coverImagePath}')`

        const titleDiv = document.createElement("p");
        titleDiv.classList.add("bookTitle");
        titleDiv.innerHTML = volumeName;

        volumeDivContainer.appendChild(coverDiv);
        volumeDivContainer.appendChild(titleDiv);


        volumeDivContainer.addEventListener("pointerdown", () => {
            wasHeld = false;
            if (!AppState.activeSession.isDownloadMode) {
                pressTimer = setTimeout(() => {
                    wasHeld = true
                    console.log("This is a HOLD! Go to Volume Menu.");
                    // openVolumeInfo(volume);
                    //I decided imma have a small easy menu that opens when you hold down on a volume since itd be nice
                }, 500); 
            }
        });
        volumeDivContainer.addEventListener("pointerup", () => {
            if (AppState.activeSession.isDownloadMode) {
                const isCurrentlySaved = coverDiv.classList.contains("status-downloaded");

                if (isCurrentlySaved) {
                    // Tell Service Worker to delete
                    deleteVolumeDownload(coverDiv.getAttribute("data-file-url"));
                    
                    // Instantly update UI to red so it feels responsive
                    coverDiv.classList.replace("status-downloaded", "status-missing");
                } else {
                    // Tell Service Worker to download
                    downloadVolume(coverDiv.getAttribute("data-file-url"));
                    
                    // Instantly update UI to green
                    coverDiv.classList.replace("status-missing", "status-downloaded");
                }
            } else {
                if (!wasHeld) {
                    clearTimeout(pressTimer);
                    console.log("This is a TAP! Continue reading.");
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

async function openVolumeMenu(novel){
    await buildVolumeMenu(novel);
    viewSwitcher("volumeMenu");
}


// ========================================================================== //
// 5. READER & CHAPTER LOGIC
// ========================================================================== //

async function buildReader(){
    if (!AppState.activeSession.triggeringButton == null){
        AppState.activeSession.triggeringButton.style.left = AppState.activeSession.currentButtonPositionX;
        AppState.activeSession.triggeringButton.style.top = AppState.activeSession.currentButtonPositionY;
    }
    const chapterContainer = document.getElementById("chapterContent");
    chapterContainer.innerHTML = "";
    const gallryWrapper = document.getElementById("galleryWrapper");

    let desiredChapter;

    if (!AppState.activeSession.isArtBook) {

        const currentChapter = AppState.activeSession.currentChapter;
        const currentFullVolume = AppState.activeSession.loadedVolume;

        desiredChapter = currentFullVolume.chapters.find(chapter => chapter.chapterNumber === currentChapter);

        if (desiredChapter == undefined){
            desiredChapter = currentFullVolume.chapters[0];
        }

        AppState.activeSession.currentChapter = desiredChapter.chapterNumber;

        updateSaveData();
        
        const chapterData = desiredChapter.content;
    } else {
        const currentChapter = 1;
        const currentFullVolume = AppState.activeSession.loadedArtBook;

        desiredChapter = currentFullVolume.chapters[0];
    }
    const chapterData = desiredChapter.content;

    if (AppState.activeSession.isArtBook) {
        chapterContainer.classList.replace("active", "hidden");
        gallryWrapper.classList.replace("hidden", "active");
        const galleryGrid = document.getElementById("galleryGrid");
        galleryGrid.innerHTML = "";


        // 2. Loop through the "paragraphs" (which are actually image paths)
        AppState.activeSession.loadedArtBook.chapters[0].content.forEach(imagePath => {
        // MUST be an img element, not a div
            const img = document.createElement("img");
            img.src = imagePath;
            img.className = "generic-gallery-item"; // Uniform target for Masonry

            // Attach the lightbox trigger
            img.addEventListener("pointerup", () => {
                openGenericLightbox(imagePath);
            });

            galleryGrid.appendChild(img);
        });
        // Initialize Masonry OUTSIDE your rendering loop
        const msnry = new Masonry(galleryGrid, {
            itemSelector: '.generic-gallery-item',
            
            // 1. Tell Masonry the exact width of our base items
            columnWidth: 55, 
            
            // 2. Define the horizontal gap between columns (10px matches our margin-bottom)
            gutter: 10, 
            
            // 3. This forces Masonry to center the grid perfectly inside the container
            fitWidth: true, 
            
            transitionDuration: '0.2s'
        });

        // The Offline Image Loading Hack (Required for Masonry)
        const allGeneratedImages = document.querySelectorAll('.generic-gallery-item');
        allGeneratedImages.forEach(img => {
            img.onload = () => {
                msnry.layout(); 
            };
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

async function fetchVolume() {
    novelName = AppState.activeSession.currentNovel;
    let fileName;
    if (!AppState.activeSession.isArtBook){
        getSaveData(novelName);
        const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
        const volumesList = currentNovelObj.volumes;
        console.log(volumesList);
        console.log(AppState.activeSession.currentVolume);
        const currentVolumeObj = volumesList.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume);
        console.log(currentVolumeObj);
        fileName = currentVolumeObj.fileName;
    } else {
        const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
        const artBook = currentNovelObj.volumes[0];
        fileName = artBook.fileName;
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
        
        console.log("Volume loaded successfully:", AppState.activeSession.loadedVolume);
    } catch (error) {
        //this runs
        console.error("Failed to load the volume file. Is it in the right folder?", error);
    }
}

function switchChapter(direction){
    const novelName = AppState.activeSession.currentNovel;
    const currentNovelObj = AppState.library.find(series => series.seriesName === novelName);
    const volumesList = currentNovelObj.volumes;

    const currentVolume = volumesList.find(volume => volume.volumeNumber === AppState.activeSession.currentVolume)
    const volumeNumber = currentVolume.volumeNumber;

    const totalVolumes = volumesList.length;

    if (direction == "next"){
        if (AppState.activeSession.loadedVolume.chapters.find(chapter => chapter.chapterNumber === AppState.activeSession.currentChapter + 1) != undefined){
            AppState.activeSession.currentChapter += 1
            updateSaveData();
            buildMainTLM();
            buildReader();
        } else if (volumeNumber < totalVolumes){
            AppState.activeSession.currentChapter += 1
            AppState.activeSession.currentVolume += 1
            updateSaveData();
            buildMainTLM();
            openReader()
        }
    } else if (direction == "previous"){
        if (AppState.activeSession.loadedVolume.chapters.find(chapter => chapter.chapterNumber === AppState.activeSession.currentChapter - 1) != undefined){
            AppState.activeSession.currentChapter -= 1
            updateSaveData();
            buildMainTLM();
            buildReader();
        } else if (volumeNumber > 0){
            AppState.activeSession.currentChapter -= 1
            AppState.activeSession.currentVolume -= 1
            updateSaveData();
            buildMainTLM();
            openReader();
        }
    } else{
        console.log("error switching chapters");
    }
}

async function openReader(){
    await fetchVolume();
    await buildReader();
    viewSwitcher("reader");
}


// ========================================================================== //
// 6. GLOBAL NAVIGATION
// ========================================================================== //

function viewSwitcher(targetViewId) {
    viewList.forEach(viewId => {
        const element = document.getElementById(viewId);
        
        if (viewId === targetViewId) {
            element.classList.replace("hidden", "active");
        } else {
            element.classList.replace("active", "hidden");
        }
    });
}

// Generic Example: Do not copy-paste directly. Map to your architecture.

function formatVolumeName(rawText) {
    // Converts "My Novel Name" into "my-novel-name"
    return rawText.toLowerCase().replace(/\s+/g, '-');
}

function formatSeriesName(rawText) {
    // Converts "My Novel Name" into "my-novel-name"
    return rawText.replace(/\s+/g, '-');
}

function applyCoverWithFallbacks(targetHtmlElement, seriesName, volumeNumber) {
    const safeSeriesStringPic = formatVolumeName(seriesName);
    const specificBookFile = `${safeSeriesStringPic}-${volumeNumber}`;
    const safeSeriesString = formatSeriesName(seriesName)

    // Define the priority order of images to test
    const targetPaths = [
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.png`,
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.jpg`,
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.webp`,
        `Images/Volume-Covers/${safeSeriesString}/${specificBookFile}.jpeg`,
        `Images/Novel-Covers/${safeSeriesString}.png`,
        `Images/Novel-Covers/${safeSeriesString}.jpg`,
        `Images/Novel-Covers/${safeSeriesString}.jpeg`,
        `Images/Novel-Covers/${safeSeriesString}.webp`
    ];

    function tryLoadingImage(pathsArray) {
        // Base case: We ran out of URLs to test.
        // It fails gracefully by doing nothing, allowing your default CSS styling to show.
        if (pathsArray.length === 0) return; 

        const testerImage = new Image();
        
        testerImage.onload = () => {
            // The image was found successfully. Apply it.
            targetHtmlElement.style.backgroundImage = `url('${pathsArray[0]}')`;
            targetHtmlElement.style.backgroundSize = "cover";
            targetHtmlElement.style.backgroundPosition = "center";
        };
        
        testerImage.onerror = () => {
            // The file does not exist. Slice the array and test the next format in line.
            tryLoadingImage(pathsArray.slice(1));
        };

        // This triggers the network request (which your Bouncer will intercept)
        testerImage.src = pathsArray[0];
    }

    // Start the testing sequence
    tryLoadingImage(targetPaths);
}


function formatArtTitle(rawFilePath) {
    const fileNameWithExt = rawFilePath.split('/').pop(); // Gets "cool-sword.jpg"
    const rawName = fileNameWithExt.split('.')[0]; // Gets "cool-sword"
    return rawName.replace(/-/g, ' '); // Replaces hyphens with spaces
}

function openGenericLightbox(imagePath) {
    const overlay = document.getElementById("generic-lightbox-overlay");
    const imageEl = document.getElementById("generic-lightbox-image");
    const textEl = document.getElementById("generic-lightbox-text");

    textEl.innerHTML = formatArtTitle(imagePath);
    imageEl.src = imagePath;

    overlay.classList.replace("hidden", "active");
}

function closeGenericLightbox() {
    document.getElementById("generic-lightbox-overlay").classList.replace("active", "hidden");
}

// Allow clicking the background to close it
document.getElementById("generic-lightbox-overlay").addEventListener("pointerup", (e) => {
    // Prevents the menu from closing if they accidentally tap the image itself
    if (e.target.id !== "generic-lightbox-image") {
        closeGenericLightbox();
    }
});
// ========================================================================== //
// 7. SAVE DATA MANAGEMENT
// ========================================================================== //
const STORAGE_KEY = "novelReader_offlineSaveData"

function deleteVolumeDownload(volumeURL){
        if (navigator.serviceWorker.controller){

        navigator.serviceWorker.controller.postMessage({
            action: "MANUAL_DELETE",
            targetUrl: volumeURL
        });
    } else {
        console.warn("The Service Worker is not controlling this page yet.");
    }
}


function downloadVolume(volumeURL){
    if (navigator.serviceWorker.controller){

        navigator.serviceWorker.controller.postMessage({
            action: "MANUAL_SAVE",
            targetUrl: volumeURL
        });
    } else {
        console.warn("The Service Worker is not controlling this page yet.");
    }
}

function saveToLocalStorage(dataObject){
    const dataString = JSON.stringify(dataObject);
    localStorage.setItem(STORAGE_KEY, dataString);
}



function getFromLocalStorage(){
    const savedString = localStorage.getItem(STORAGE_KEY);

    if (!savedString) return;

    const parsedData = JSON.parse(savedString);
    AppState.storedData = parsedData;
    console.log(parsedData)
}


function getSaveData(novelName){
    if (AppState.storedData.novelSaves[novelName]){
        AppState.activeSession.currentVolume = AppState.storedData.novelSaves[novelName].volume;
        AppState.activeSession.currentChapter = AppState.storedData.novelSaves[novelName].chapter;
        AppState.activeSession.currentScroll = AppState.storedData.novelSaves[novelName].scroll;
        return;
    } else if (novelName == null){
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
    const cache = await caches.open("volume-downloads-v4");
    const response = await cache.match(desiredURL);

    return !!response; 
} 

function registerServiceWorker() {
    // Check if the browser supports Service Workers
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(() => console.log("Offline Engine (Service Worker) Registered!"))
            .catch(err => console.error("SW Registration failed", err));
    }
}

// ========================================================================== //
// BOOT
// ========================================================================== //

main();