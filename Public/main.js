/**
 * This is the main frontend script.
 * It handles form submission, API calls, and chart rendering.
 */

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  const ganttForm = document.getElementById('gantt-form');
  ganttForm.addEventListener('submit', handleChartGenerate);

  // --- NEW: File input listener ---
  const fileInput = document.getElementById('file-input');
  const dropzonePrompt = document.getElementById('dropzone-prompt');
  const fileListContainer = document.getElementById('file-list-container');
  const fileList = document.getElementById('file-list');

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      // Files are selected
      fileList.innerHTML = ''; // Clear previous list
      
      for (const file of fileInput.files) {
        const li = document.createElement('li');
        // Use truncate class from Tailwind
        li.className = 'truncate'; 
        li.textContent = file.name;
        li.title = file.name; // Show full name on hover
        fileList.appendChild(li);
      }
      
      dropzonePrompt.classList.add('hidden');
      fileListContainer.classList.remove('hidden');
    } else {
      // No files selected
      dropzonePrompt.classList.remove('hidden');
      fileListContainer.classList.add('hidden');
    }
  });
  // --- END: File input listener ---
});

/**
 * Handles the "Generate Chart" button click
 */
async function handleChartGenerate(event) {
  event.preventDefault(); // Stop form from reloading page

  const generateBtn = document.getElementById('generate-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const chartOutput = document.getElementById('chart-output');

  // 1. Get form data
  const promptInput = document.getElementById('prompt-input');
  const fileInput = document.getElementById('file-input');
  
  // --- MODIFICATION: Check if files are uploaded ---
  if (fileInput.files.length === 0) {
    errorMessage.textContent = 'Error: Please upload at least one research document.';
    errorMessage.style.display = 'block';
    return;
  }
  // ---

  const formData = new FormData();
  formData.append('prompt', promptInput.value);
  for (const file of fileInput.files) {
    formData.append('researchFiles', file);
  }

  // 2. Update UI to show loading
  generateBtn.disabled = true;
  loadingIndicator.style.display = 'flex';
  errorMessage.style.display = 'none';
  chartOutput.innerHTML = ''; // Clear old chart

  try {
    // 3. Call the backend API (for the *initial* chart)
    const response = await fetch('/generate-chart', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    // 4. Get the JSON data from the server
    // *** FIX: The server sends the object *directly* now. ***
    const ganttData = await response.json();

    // 5. Validate the data structure
    if (!ganttData || !ganttData.timeColumns || !ganttData.data) {
      throw new Error('Invalid chart data structure received from server');
    }

    // --- MODIFICATION: Add stronger validation for empty data ---
    if (ganttData.timeColumns.length === 0 || ganttData.data.length === 0) {
      console.warn("AI returned valid but empty data.", ganttData);
      throw new Error('The AI was unable to find any tasks or time columns in the provided documents. Please check your files or try a different prompt.');
    }
    // --- END: New validation ---

    // 6. Render the chart
    setupChart(ganttData);

  } catch (error) {
    console.error("Error generating chart:", error);
    errorMessage.textContent = `Error: ${error.message}`;
    errorMessage.style.display = 'block';
  } finally {
    // 7. Restore UI
    generateBtn.disabled = false;
    loadingIndicator.style.display = 'none';
  }
}

/**
 * The Dynamic Renderer.
 * This function builds the chart *based on* the data from the server.
 */
function setupChart(ganttData) {
  
  const container = document.getElementById('chart-output');
  if (!container) {
    console.error("Could not find chart container!");
    return;
  }
  
  // Clear container
  container.innerHTML = '';

  // Create the main chart wrapper
  const chartWrapper = document.createElement('div');
  chartWrapper.id = 'gantt-chart-container'; // ID for styling & export

  // Add Title (from data)
  const titleEl = document.createElement('div');
  titleEl.className = 'gantt-title';
  titleEl.textContent = ganttData.title;
  chartWrapper.appendChild(titleEl);

  // Create Grid
  const gridEl = document.createElement('div');
  gridEl.className = 'gantt-grid';
  
  // --- Dynamic Grid Columns ---
  const numCols = ganttData.timeColumns.length;
  // --- MODIFICATION: Increased min-width from 220px to 330px (50% wider) ---
  gridEl.style.gridTemplateColumns = `minmax(330px, 1.5fr) repeat(${numCols}, 1fr)`;

  // --- Create Header Row ---
  const headerLabel = document.createElement('div');
  headerLabel.className = 'gantt-header gantt-header-label';
  gridEl.appendChild(headerLabel);
  
  for (const colName of ganttData.timeColumns) {
    const headerCell = document.createElement('div');
    headerCell.className = 'gantt-header';
    headerCell.textContent = colName;
    gridEl.appendChild(headerCell);
  }

  // --- Create Data Rows ---
  for (const row of ganttData.data) {
    const isSwimlane = row.isSwimlane;
    
    // 1. Create Label Cell
    const labelEl = document.createElement('div');
    labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;
    labelEl.textContent = row.title;
    gridEl.appendChild(labelEl);
    
    // 2. Create Bar Area
    const barAreaEl = document.createElement('div');
    barAreaEl.className = `gantt-bar-area ${isSwimlane ? 'swimlane' : 'task'}`;
    barAreaEl.style.gridColumn = `2 / span ${numCols}`;
    barAreaEl.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    
    // Add empty cells for vertical grid lines
    for (let i = 1; i <= numCols; i++) {
      const cell = document.createElement('span');
      cell.setAttribute('data-col', i);
      barAreaEl.appendChild(cell);
    }

    // 3. Add the bar (if it's a task and has bar data)
    if (!isSwimlane && row.bar && row.bar.startCol != null) {
      const bar = row.bar;
      
      const barEl = document.createElement('div');
      barEl.className = 'gantt-bar';
      barEl.setAttribute('data-color', bar.color || 'default');
      barEl.style.gridColumn = `${bar.startCol} / ${bar.endCol}`;
      
      barAreaEl.appendChild(barEl);

      // --- NEW: Add click listener for analysis ---
      // We make both the label and the bar area clickable
      const taskIdentifier = { taskName: row.title, entity: row.entity };
      labelEl.addEventListener('click', () => showAnalysisModal(taskIdentifier));
      barAreaEl.addEventListener('click', () => showAnalysisModal(taskIdentifier));
      labelEl.style.cursor = 'pointer';
      barAreaEl.style.cursor = 'pointer';
    }
    
    gridEl.appendChild(barAreaEl);
  }

  chartWrapper.appendChild(gridEl);
  
  // --- Add Export Button ---
  const exportContainer = document.createElement('div');
  exportContainer.className = 'export-container';
  const exportBtn = document.createElement('button');
  exportBtn.id = 'export-png-btn';
  exportBtn.className = 'export-button';
  exportBtn.textContent = 'Export as PNG';
  exportContainer.appendChild(exportBtn);
  
  // Add the chart and button to the page
  container.appendChild(chartWrapper);
  container.appendChild(exportContainer);

  // Add Export Functionality
  addExportListener();

  // --- NEW: Add "Today" Line ---
  // We use the provided date: November 13, 2025
  const today = new Date('2025-11-13T12:00:00'); 
  addTodayLine(gridEl, ganttData.timeColumns, today);
}

/**
 * Finds the export button and chart container, then
 * adds a click listener to trigger html2canvas.
 */
function addExportListener() {
  const exportBtn = document.getElementById('export-png-btn');
  const chartContainer = document.getElementById('gantt-chart-container');

  if (!exportBtn || !chartContainer) {
    console.warn("Export button or chart container not found.");
    return;
  }

  exportBtn.addEventListener('click', () => {
    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;

    html2canvas(chartContainer, { 
      useCORS: true,
      logging: false,
      scale: 2 // Render at 2x resolution
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'gantt-chart.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      exportBtn.textContent = 'Export as PNG';
      exportBtn.disabled = false;
    }).catch(err => {
      console.error("Error exporting canvas:", err);
      exportBtn.textContent = 'Export as PNG';
      exportBtn.disabled = false;
      alert("Error exporting chart. See console for details.");
    });
  });
}

// -------------------------------------------------------------------
// --- "TODAY" LINE HELPER FUNCTIONS ---
// -------------------------------------------------------------------

/**
 * Calculates and adds the "Today" line to the grid.
 * @param {HTMLElement} gridEl - The main .gantt-grid element.
 * @param {string[]} timeColumns - The array of time columns (e.g., ["Q1 2025", ...]).
 * @param {Date} today - The current date object.
 */
function addTodayLine(gridEl, timeColumns, today) {
  const position = findTodayColumnPosition(today, timeColumns);
  if (!position) return; // Today is not in the chart's range

  try {
    // Get element dimensions for calculation
    const labelCol = gridEl.querySelector('.gantt-header-label');
    const headerRow = gridEl.querySelector('.gantt-header');
    
    if (!labelCol || !headerRow) return;

    const labelColWidth = labelCol.offsetWidth;
    const headerHeight = headerRow.offsetHeight;
    const gridWidth = gridEl.offsetWidth;

    // Calculate pixel position
    const timeColAreaWidth = gridWidth - labelColWidth;
    const oneColWidth = timeColAreaWidth / timeColumns.length;
    const todayOffset = (position.index + position.percentage) * oneColWidth;
    const lineLeftPosition = labelColWidth + todayOffset;

    // Create and append the line
    const todayLine = document.createElement('div');
    todayLine.className = 'gantt-today-line';
    todayLine.style.top = `${headerHeight}px`;
    todayLine.style.bottom = '0';
    todayLine.style.left = `${lineLeftPosition}px`;
    
    gridEl.appendChild(todayLine);

  } catch (e) {
    console.error("Error calculating 'Today' line position:", e);
  }
}

/**
 * Finds the column index and percentage offset for today's date.
 * @param {Date} today - The current date.
 * @param {string[]} timeColumns - The array of time columns.
 * @returns {{index: number, percentage: number} | null}
 */
function findTodayColumnPosition(today, timeColumns) {
  if (timeColumns.length === 0) return null;

  const firstCol = timeColumns[0];
  const todayYear = today.getFullYear();

  // 1. Check for Year columns (e.g., "2025")
  if (/^\d{4}$/.test(firstCol)) {
    const todayYearStr = todayYear.toString();
    const index = timeColumns.indexOf(todayYearStr);
    if (index === -1) return null;

    const startOfYear = new Date(todayYear, 0, 1);
    const endOfYear = new Date(todayYear, 11, 31);
    const dayOfYear = (today - startOfYear) / (1000 * 60 * 60 * 24);
    const totalDays = (endOfYear - startOfYear) / (1000 * 60 * 60 * 24);
    const percentage = dayOfYear / totalDays;
    return { index, percentage };
  }

  // 2. Check for Quarter columns (e.g., "Q4 2025")
  if (/^Q[1-4]\s\d{4}$/.test(firstCol)) {
    const month = today.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const todayQuarterStr = `Q${quarter} ${todayYear}`;
    const index = timeColumns.indexOf(todayQuarterStr);
    if (index === -1) return null;

    const quarterStartMonth = (quarter - 1) * 3;
    const startOfQuarter = new Date(todayYear, quarterStartMonth, 1);
    const endOfQuarter = new Date(todayYear, quarterStartMonth + 3, 0); // 0th day of next month
    const dayInQuarter = (today - startOfQuarter) / (1000 * 60 * 60 * 24);
    const totalDays = (endOfQuarter - startOfQuarter) / (1000 * 60 * 60 * 24);
    const percentage = dayInQuarter / totalDays;
    return { index, percentage };
  }

  // 3. Check for Month columns (e.g., "Nov 2025")
  if (/^[A-Za-z]{3}\s\d{4}$/.test(firstCol)) {
    const todayMonthStr = today.toLocaleString('en-US', { month: 'short' }) + ` ${todayYear}`;
    const index = timeColumns.indexOf(todayMonthStr);
    if (index === -1) return null;

    const startOfMonth = new Date(todayYear, today.getMonth(), 1);
    const endOfMonth = new Date(todayYear, today.getMonth() + 1, 0);
    const dayInMonth = today.getDate(); // 13th
    const totalDays = endOfMonth.getDate(); // 30 for Nov
    const percentage = dayInMonth / totalDays;
    return { index, percentage };
  }
  
  // 4. Check for Week columns (e.g., "W46 2025")
  if (/^W\d{1,2}\s\d{4}$/.test(firstCol)) {
    const todayWeekStr = `W${getWeek(today)} ${todayYear}`;
    const index = timeColumns.indexOf(todayWeekStr);
    if (index === -1) return null;

    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const percentage = (dayOfWeek + 0.5) / 7; // Place line in middle of the day
    return { index, percentage };
  }

  return null; // Unknown format
}

/**
 * Gets the ISO 8601 week number for a given date.
 * @param {Date} date - The date.
 *S @returns {number} The week number.
 */
function getWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}


// -------------------------------------------------------------------
// --- "ON-DEMAND" ANALYSIS MODAL ---
// -------------------------------------------------------------------

/**
 * Creates and shows the analysis modal.
 * Fetches data from the new /get-task-analysis endpoint.
 */
async function showAnalysisModal(taskIdentifier) {
  // 1. Remove any old modal
  document.getElementById('analysis-modal')?.remove();

  // 2. Create modal structure
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'analysis-modal';
  modalOverlay.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Analyzing...</h3>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body" id="modal-body-content">
      <div class="modal-spinner"></div>
    </div>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // 3. Add close listeners
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    modalOverlay.remove();
  });

  // 4. Fetch the analysis data
  try {
    const response = await fetch('/get-task-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskIdentifier)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Server error"); // This is line 275
    }

    const analysis = await response.json();
    const modalBody = document.getElementById('modal-body-content');

    // 5. Populate the modal with the analysis
    document.querySelector('.modal-title').textContent = analysis.taskName;
    modalBody.innerHTML = `
      ${buildAnalysisSection('Status', `<span class="status-pill status-${analysis.status.replace(/\s+/g, '-').toLowerCase()}">${analysis.status}</span>`)}
      ${buildAnalysisSection('Dates', `${analysis.startDate || 'N/A'} to ${analysis.endDate || 'N/A'}`)}
      ${buildAnalysisList('Facts', analysis.facts, 'fact', 'source')}
      ${buildAnalysisList('Assumptions', analysis.assumptions, 'assumption', 'source')}
      ${buildAnalysisSection('Summary', analysis.summary)}
      ${buildAnalysisSection('Rationale / Hurdles', analysis.rationale)}
    `;

    // 6. --- NEW: Add the chat interface ---
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.innerHTML = `
      <h4 class="chat-title">Ask a follow-up</h4>
      <div class="chat-history" id="chat-history"></div>
      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="Ask about this task..." autocomplete="off">
        <button type="submit" class="chat-send-btn">Send</button>
      </form>
    `;
    modalBody.appendChild(chatContainer);

    // 7. --- NEW: Add chat form listener ---
    const chatForm = document.getElementById('chat-form');
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAskQuestion(taskIdentifier);
    });

  } catch (error) {
    console.error("Error fetching analysis:", error); // This is line 292
    document.getElementById('modal-body-content').innerHTML = `<div class="modal-error">Failed to load analysis: ${error.message}</div>`;
  }
}

/**
 * --- NEW: Handles the chat form submission ---
 */
async function handleAskQuestion(taskIdentifier) {
  const chatInput = document.getElementById('chat-input');
  const chatHistory = document.getElementById('chat-history');
  const question = chatInput.value.trim();

  if (!question) return;

  // 1. Display user's question
  const userMessage = document.createElement('div');
  userMessage.className = 'chat-message chat-message-user';
  userMessage.textContent = question;
  chatHistory.appendChild(userMessage);

  // 2. Show loading spinner
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'chat-message chat-message-llm';
  loadingMessage.innerHTML = `<div class="chat-spinner"></div>`;
  chatHistory.appendChild(loadingMessage);

  // 3. Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // 4. Clear input
  chatInput.value = '';

  // 5. Call the new API endpoint
  try {
    const response = await fetch('/ask-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...taskIdentifier,
        question: question
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Server error");
    }

    const data = await response.json();
    
    // 6. Remove spinner and show answer
    loadingMessage.innerHTML = data.answer; // Replace spinner with text

  } catch (error) {
    console.error("Error asking question:", error);
    loadingMessage.innerHTML = `Sorry, an error occurred: ${error.message}`;
  } finally {
    // 7. Scroll to bottom again
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}


// Helper function to build a section of the modal
function buildAnalysisSection(title, content) {
  if (!content) return ''; // Don't show empty sections
  return `
    <div class="analysis-section">
      <h4>${title}</h4>
      <p>${content}</p>
    </div>
  `;
}

// Helper function to build a list of facts/assumptions
function buildAnalysisList(title, items, itemKey, sourceKey) {
  if (!items || items.length === 0) return '';
  
  const listItems = items.map(item => {
    // --- MODIFICATION: Use the 'url' field from the server ---
    const sourceText = item[sourceKey]; // e.g., "[example.com]"
    const sourceUrl = item.url; // e.g., "https://example.com/article/nine" or null
    let sourceElement = '';

    // Check if sourceUrl is a valid, non-null string
    if (sourceUrl && typeof sourceUrl === 'string' && (sourceUrl.startsWith('http') || sourceUrl.startsWith('www'))) {
      // A valid URL was provided by the AI! Render a link.
      sourceElement = `(Source: <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceText}</a>)`;
    } else {
      // No valid URL, just render plain text
      sourceElement = `(Source: ${sourceText})`;
    }

    return `<li>
      <p>${item[itemKey]}</p>
      <span class="source">${sourceElement}</span>
    </li>`;
  }).join('');
  
  return `
    <div class="analysis-section">
      <h4>${title}</h4>
      <ul class="analysis-list">${listItems}</ul>
    </div>
  `;
}