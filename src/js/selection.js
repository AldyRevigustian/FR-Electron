// src/js/selection.js
document.addEventListener('DOMContentLoaded', () => {
    const selectionForm = document.getElementById('selectionForm');
    const classSelect = document.getElementById('classSelect');
    const startButton = document.getElementById('startButton');
    const pythonMessages = document.getElementById('pythonMessages');

    // --- Populate Class dropdown ---
    const classes = [
        { id: 1, name: "Kelas A Pagi" },
        { id: 2, name: "Kelas B Sore" },
        { id: 3, name: "Kelas C Malam" },
        { id: 4, name: "Kelas D Weekend" }
    ];

    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        classSelect.appendChild(option);
    });

    selectionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        pythonMessages.innerHTML = ''; // Clear previous messages

        const selectedClassOption = classSelect.options[classSelect.selectedIndex];

        if (!selectedClassOption || !selectedClassOption.value) {
            pythonMessages.innerHTML = '<p class="error">Silakan pilih kelas terlebih dahulu!</p>';
            return;
        }

        const params = {
            classId: parseInt(selectedClassOption.value),
            className: selectedClassOption.text,
            courseId: null, // Remove course requirement
            courseName: null, // Remove course requirement
        };

        console.log('Starting recognition with:', params);
        window.electronAPI.startRecognition(params);
        startButton.disabled = true;
        startButton.innerHTML = '<span>Memulai...</span>';
        pythonMessages.innerHTML = '<p class="info">Memulai proses absensi...</p>';
    });

    // Listen for messages from Python script
    window.electronAPI.onPythonError((message) => {
        const p = document.createElement('p');
        p.className = 'error';
        p.textContent = `Error: ${message}`;
        pythonMessages.appendChild(p);
        startButton.disabled = false;
        startButton.innerHTML = '<span>Mulai Absensi</span>';
    });

    window.electronAPI.onRecognitionFinished((message) => {
        const p = document.createElement('p');
        p.className = 'success';
        p.textContent = message;
        pythonMessages.appendChild(p);
        startButton.disabled = false;
        startButton.innerHTML = '<span>Mulai Absensi</span>';
    });

    // Clean up listeners when the page is about to be unloaded
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllPythonErrorListeners();
        window.electronAPI.removeAllRecognitionFinishedListeners();
    });
});