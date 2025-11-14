/**
 * This is the main frontend script.
 * It handles form submission, API calls, and chart rendering.
 */

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  const ganttForm = document.getElementById('gantt-form');
  ganttForm.addEventListener('submit', handleChartGenerate);

  // --- File input listener ---
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

    // 6. --- MODIFICATION: Open in new tab instead of rendering here ---
    // Store the data in sessionStorage so the new tab can access it
    sessionStorage.setItem('ganttData', JSON.stringify(ganttData));
    
    // Open chart.html in a new tab
    window.open('/chart.html', '_blank');
    
    // --- REMOVED: setupChart(ganttData); ---

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

// --- ALL OTHER FUNCTIONS MOVED to chart-renderer.js ---