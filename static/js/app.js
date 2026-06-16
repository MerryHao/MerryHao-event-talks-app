// Application State
let appState = {
    rawReleases: [],
    updates: [],
    selectedUpdate: null,
    searchQuery: '',
    currentTypeFilter: 'all',
    activeHashtags: new Set(['#BigQuery', '#GCP'])
};

// DOM Elements
const DOM = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    lastUpdatedTime: document.getElementById('last-updated-time'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    typeFilters: document.getElementById('type-filters'),
    
    feedLoading: document.getElementById('feed-loading'),
    feedError: document.getElementById('feed-error'),
    errorMessage: document.getElementById('error-message'),
    feedEmpty: document.getElementById('feed-empty'),
    feedContainer: document.getElementById('feed-container'),
    retryBtn: document.getElementById('retry-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    composerCard: document.getElementById('composer-card'),
    composerEmptyState: document.getElementById('composer-empty-state'),
    composerActiveState: document.getElementById('composer-active-state'),
    composerSelectedType: document.getElementById('composer-selected-type'),
    composerSelectedDate: document.getElementById('composer-selected-date'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    hashtagsList: document.getElementById('hashtags-list'),
    charProgress: document.getElementById('char-progress'),
    charCountText: document.getElementById('char-count-text'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    tweetBtn: document.getElementById('tweet-btn'),
    clearSelectionBtn: document.getElementById('clear-selection-btn')
};

// SVG progress ring configuration
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~87.96

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Progress Ring
    DOM.charProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    DOM.charProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;
    
    // Attach Event Listeners
    DOM.refreshBtn.addEventListener('click', () => fetchReleases(true));
    DOM.retryBtn.addEventListener('click', () => fetchReleases(true));
    DOM.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Search
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.clearSearchBtn.addEventListener('click', clearSearch);
    
    // Filters
    DOM.typeFilters.addEventListener('click', handleFilterClick);
    
    // Composer
    DOM.tweetTextarea.addEventListener('input', updateCharCounter);
    DOM.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    DOM.tweetBtn.addEventListener('click', postTweet);
    DOM.clearSelectionBtn.addEventListener('click', clearSelection);
    DOM.hashtagsList.addEventListener('click', handleHashtagClick);
    
    // Initial Fetch
    fetchReleases(false);
});

// Fetch Release Notes from API
async function fetchReleases(force = false) {
    showLoading();
    
    try {
        const response = await fetch(`/api/releases?refresh=${force}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Unknown server error');
        }
        
        appState.rawReleases = result.entries;
        
        // Update Timestamp
        if (result.last_fetched) {
            const date = new Date(result.last_fetched * 1000);
            DOM.lastUpdatedTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Parse and Flatten HTML Updates
        appState.updates = parseEntries(result.entries);
        
        // Render
        renderUpdates();
        
        // Reselect if matching selected exists
        if (appState.selectedUpdate) {
            const stillExists = appState.updates.find(u => u.id === appState.selectedUpdate.id);
            if (stillExists) {
                // Keep selected but refresh data
                appState.selectedUpdate = stillExists;
                updateComposer();
            } else {
                clearSelection();
            }
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
    }
}

// Parse daily release note entries into structured list of individual updates
function parseEntries(entries) {
    const parsedUpdates = [];
    let idCounter = 0;
    
    entries.forEach(entry => {
        if (!entry.summary) return;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(entry.summary, 'text/html');
        const children = Array.from(doc.body.children);
        
        if (children.length === 0) {
            parsedUpdates.push({
                id: `up-${idCounter++}`,
                date: entry.title,
                rawDate: entry.updated,
                type: 'Other',
                html: entry.summary,
                link: entry.link
            });
            return;
        }
        
        let currentType = 'Other';
        let currentGroup = [];
        
        children.forEach(el => {
            if (el.tagName === 'H3') {
                // Save previous group if it exists
                if (currentGroup.length > 0) {
                    parsedUpdates.push({
                        id: `up-${idCounter++}`,
                        date: entry.title,
                        rawDate: entry.updated,
                        type: currentType,
                        html: currentGroup.map(node => node.outerHTML).join(''),
                        link: entry.link
                    });
                    currentGroup = [];
                }
                
                // Set new type
                const text = el.textContent.trim();
                // Map Google Cloud's types or capitalize nicely
                currentType = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            } else {
                currentGroup.push(el);
            }
        });
        
        // Save last group
        if (currentGroup.length > 0) {
            parsedUpdates.push({
                id: `up-${idCounter++}`,
                date: entry.title,
                rawDate: entry.updated,
                type: currentType,
                html: currentGroup.map(node => node.outerHTML).join(''),
                link: entry.link
            });
        }
    });
    
    return parsedUpdates;
}

// Render filtered updates to feed column
function renderUpdates() {
    DOM.feedLoading.style.display = 'none';
    DOM.feedError.style.display = 'none';
    DOM.feedEmpty.style.display = 'none';
    DOM.feedContainer.style.display = 'block';
    
    // Filter updates
    const filtered = appState.updates.filter(update => {
        // Filter by Type
        if (appState.currentTypeFilter !== 'all') {
            const mappedType = mapTypeToFilterCategory(update.type);
            if (mappedType !== appState.currentTypeFilter) return false;
        }
        
        // Filter by Search Text
        if (appState.searchQuery) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = update.html;
            const textContent = tempDiv.textContent.toLowerCase();
            
            const query = appState.searchQuery.toLowerCase();
            const matchesText = textContent.includes(query);
            const matchesType = update.type.toLowerCase().includes(query);
            const matchesDate = update.date.toLowerCase().includes(query);
            
            if (!matchesText && !matchesType && !matchesDate) return false;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        DOM.feedContainer.style.display = 'none';
        DOM.feedEmpty.style.display = 'flex';
        return;
    }
    
    // Group updates by date for display
    const groups = {};
    filtered.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });
    
    DOM.feedContainer.innerHTML = '';
    
    Object.keys(groups).forEach(date => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'date-group';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = date;
        groupDiv.appendChild(dateHeader);
        
        groups[date].forEach(update => {
            const card = document.createElement('article');
            card.className = `glass-card update-card ${appState.selectedUpdate && appState.selectedUpdate.id === update.id ? 'selected' : ''}`;
            card.dataset.id = update.id;
            
            // Generate clean class name for badge
            const badgeClass = update.type.toLowerCase();
            const badgeText = update.type;
            
            card.innerHTML = `
                <div class="update-card-header">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    <div class="card-actions">
                        <button class="card-btn btn-tweet" title="Draft Tweet">
                            <i class="fa-brands fa-x-twitter"></i>
                        </button>
                        <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="card-btn" title="Open official documentation" onclick="event.stopPropagation();">
                            <i class="fa-solid fa-link"></i>
                        </a>
                    </div>
                </div>
                <div class="update-content">
                    ${update.html}
                </div>
            `;
            
            // Adjust all anchor tags in the card content to open in a new tab
            card.querySelectorAll('.update-content a').forEach(a => {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                // stopPropagation so clicking links inside card doesn't select the card
                a.addEventListener('click', (e) => e.stopPropagation());
            });
            
            // Clicking card selects it
            card.addEventListener('click', () => selectUpdate(update, card));
            
            groupDiv.appendChild(card);
        });
        
        DOM.feedContainer.appendChild(groupDiv);
    });
}

// Map the raw H3 update type to the categorical filters
function mapTypeToFilterCategory(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'feature';
    if (t.includes('issue') || t.includes('bug')) return 'issue';
    if (t.includes('change')) return 'changed';
    if (t.includes('deprecat')) return 'deprecated';
    return 'other';
}

// Select an update card
function selectUpdate(update, cardEl) {
    // If clicking already selected, keep it selected or allow toggling
    appState.selectedUpdate = update;
    
    // Remove selected class from all cards
    document.querySelectorAll('.update-card').forEach(card => card.classList.remove('selected'));
    cardEl.classList.add('selected');
    
    // Update Composer Panel
    updateComposer();
}

// Update Tweet Composer based on selected update
function updateComposer() {
    if (!appState.selectedUpdate) {
        clearSelection();
        return;
    }
    
    const update = appState.selectedUpdate;
    
    // Show active states
    DOM.composerEmptyState.style.display = 'none';
    DOM.composerActiveState.style.display = 'flex';
    DOM.clearSelectionBtn.style.display = 'block';
    DOM.composerCard.classList.add('active-editing');
    
    // Set meta tags
    DOM.composerSelectedType.className = `selected-badge badge ${update.type.toLowerCase()}`;
    DOM.composerSelectedType.textContent = update.type;
    DOM.composerSelectedDate.textContent = update.date;
    
    // Auto Draft Tweet
    const tweetText = generateTweetText(update);
    DOM.tweetTextarea.value = tweetText;
    
    // Update count
    updateCharCounter();
}

// Clear currently selected update
function clearSelection() {
    appState.selectedUpdate = null;
    document.querySelectorAll('.update-card').forEach(card => card.classList.remove('selected'));
    
    DOM.composerEmptyState.style.display = 'flex';
    DOM.composerActiveState.style.display = 'none';
    DOM.clearSelectionBtn.style.display = 'none';
    DOM.composerCard.classList.remove('active-editing');
}

// Generate smart tweet text with 280 length constraint
function generateTweetText(update) {
    // Strip year for brevity
    const dateStr = update.date.replace(', 2026', '').replace(', 2025', '');
    
    let emoji = '📢';
    const t = update.type.toLowerCase();
    if (t.includes('feature')) emoji = '🚀';
    else if (t.includes('issue') || t.includes('bug')) emoji = '⚠️';
    else if (t.includes('deprecat')) emoji = '🚫';
    else if (t.includes('change')) emoji = '🔄';
    else if (t.includes('security')) emoji = '🔒';
    
    // Clean HTML to text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = update.html;
    
    // Convert <code> elements to markdown code backticks
    tempDiv.querySelectorAll('code').forEach(el => {
        el.textContent = `\`${el.textContent}\``;
    });
    
    let cleanText = tempDiv.textContent.trim().replace(/\s+/g, ' ');
    
    // Compile elements
    const header = `${emoji} BigQuery ${update.type} (${dateStr}): `;
    const link = update.link; // standard link counts as 23 characters in Twitter
    
    // Tags
    const tagsArr = Array.from(appState.activeHashtags);
    const tagsStr = tagsArr.join(' ');
    
    // Calculating budgets
    // Formula: Total(280) = HeaderLength + TextLength + TwitterLinkLength(23) + TagsLength + Newlines/Spaces
    // We have: header + cleanText + "\n" + link + "\n" + tagsStr
    // Spacing characters count: 2 newlines (4 chars)
    const spaceOffset = 4;
    const reservedLength = header.length + 23 + tagsStr.length + spaceOffset;
    const availableLength = 280 - reservedLength;
    
    if (cleanText.length > availableLength) {
        cleanText = cleanText.substring(0, availableLength - 3) + '...';
    }
    
    return `${header}${cleanText}\n${link}\n${tagsStr}`;
}

// Handle keyup/input in textarea to count characters and fill SVG progress ring
function updateCharCounter() {
    const text = DOM.tweetTextarea.value;
    
    // Twitter handles URLs specially. Standard url counts as 23 characters
    const urlRegex = /https?:\/\/[^\s]+/g;
    let urlLengthCorrection = 0;
    
    const matches = text.match(urlRegex);
    let textToCount = text;
    if (matches) {
        matches.forEach(url => {
            textToCount = textToCount.replace(url, '');
            urlLengthCorrection += 23; // Add 23 chars for each URL found
        });
    }
    
    const count = textToCount.length + urlLengthCorrection;
    const remaining = 280 - count;
    
    DOM.charCountText.textContent = remaining;
    
    // Color states
    DOM.charCountText.className = 'char-count-text';
    if (remaining <= 0) {
        DOM.charCountText.classList.add('danger');
    } else if (remaining <= 40) {
        DOM.charCountText.classList.add('warning');
    }
    
    // SVG Progress
    const percentage = Math.min(count / 280, 1);
    const offset = RING_CIRCUMFERENCE - (percentage * RING_CIRCUMFERENCE);
    DOM.charProgress.style.strokeDashoffset = offset;
    
    // Color stroke on progress ring
    if (remaining <= 0) {
        DOM.charProgress.style.stroke = 'var(--accent-red)';
    } else if (remaining <= 40) {
        DOM.charProgress.style.stroke = 'var(--accent-orange)';
    } else {
        DOM.charProgress.style.stroke = 'var(--accent-cyan)';
    }
    
    // Disable tweet button if over limit or empty
    DOM.tweetBtn.disabled = count === 0 || remaining < 0;
}

// Handle clicking on hashtags to toggle them
function handleHashtagClick(e) {
    const button = e.target.closest('.hashtag-pill');
    if (!button) return;
    
    const tag = button.dataset.tag;
    if (appState.activeHashtags.has(tag)) {
        appState.activeHashtags.delete(tag);
        button.classList.remove('active');
    } else {
        appState.activeHashtags.add(tag);
        button.classList.add('active');
    }
    
    // Re-draft with updated hashtags
    if (appState.selectedUpdate) {
        updateComposer();
    }
}

// Copy Tweet text to Clipboard
function copyTweetToClipboard() {
    const text = DOM.tweetTextarea.value;
    navigator.clipboard.writeText(text).then(() => {
        const icon = DOM.copyTweetBtn.querySelector('i');
        icon.className = 'fa-solid fa-check';
        DOM.copyTweetBtn.style.borderColor = 'var(--accent-cyan)';
        DOM.copyTweetBtn.style.color = 'var(--accent-cyan)';
        
        setTimeout(() => {
            icon.className = 'fa-regular fa-copy';
            DOM.copyTweetBtn.style.borderColor = '';
            DOM.copyTweetBtn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Open Tweet intent on Twitter
function postTweet() {
    const text = DOM.tweetTextarea.value;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Search & Filter event handlers
function handleSearchInput() {
    appState.searchQuery = DOM.searchInput.value;
    DOM.clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
    renderUpdates();
}

function clearSearch() {
    DOM.searchInput.value = '';
    appState.searchQuery = '';
    DOM.clearSearchBtn.style.display = 'none';
    renderUpdates();
}

function handleFilterClick(e) {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    
    // Toggle active filter
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    appState.currentTypeFilter = pill.dataset.type;
    renderUpdates();
}

function resetFilters() {
    clearSearch();
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.filter-pill[data-type="all"]').classList.add('active');
    appState.currentTypeFilter = 'all';
    renderUpdates();
}

// Loading and Error visuals
function showLoading() {
    DOM.refreshIcon.classList.add('spinning');
    DOM.refreshBtn.disabled = true;
    DOM.feedLoading.style.display = 'block';
    DOM.feedError.style.display = 'none';
    DOM.feedEmpty.style.display = 'none';
    DOM.feedContainer.style.display = 'none';
}

function showError(msg) {
    DOM.refreshIcon.classList.remove('spinning');
    DOM.refreshBtn.disabled = false;
    DOM.feedLoading.style.display = 'none';
    DOM.feedError.style.display = 'flex';
    DOM.errorMessage.textContent = msg || 'Could not connect to the release feed. Please try again.';
}

function renderUpdatesComplete() {
    DOM.refreshIcon.classList.remove('spinning');
    DOM.refreshBtn.disabled = false;
}

// Wrap renderUpdates to ensure spinner gets cleared
const originalRenderUpdates = renderUpdates;
renderUpdates = function() {
    originalRenderUpdates();
    renderUpdatesComplete();
};
