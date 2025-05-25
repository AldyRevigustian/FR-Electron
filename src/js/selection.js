// src/js/selection.js
document.addEventListener('DOMContentLoaded', () => {
    const selectionForm = document.getElementById('selectionForm');
    const classSelect = document.getElementById('classSelect'); // Assuming <select id="classSelect">
    const courseSelect = document.getElementById('courseSelect'); // Assuming <select id="courseSelect">
    const startButton = document.getElementById('startButton');
    const pythonMessages = document.getElementById('pythonMessages');

    // --- Populate Class and Course dropdowns (Example: hardcoded) ---
    // In a real app, fetch these from your database via IPC
    const classes = [
        { id: 1, name: "Kelas A Pagi" },
        { id: 2, name: "Kelas B Sore" }
    ];
    const courses = [
        { id: 101, name: "Pemrograman Dasar" },
        { id: 102, name: "Kecerdasan Buatan" }
    ];

    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        classSelect.appendChild(option);
    });

    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.name;
        courseSelect.appendChild(option);
    });
    // --- End of example population ---


    selectionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        pythonMessages.innerHTML = ''; // Clear previous messages

        const selectedClassOption = classSelect.options[classSelect.selectedIndex];
        const selectedCourseOption = courseSelect.options[courseSelect.selectedIndex];

        const params = {
            classId: parseInt(selectedClassOption.value),
            className: selectedClassOption.text,
            courseId: parseInt(selectedCourseOption.value),
            courseName: selectedCourseOption.text,
        };

        console.log('Starting recognition with:', params);
        window.electronAPI.startRecognition(params);
        startButton.disabled = true;
        pythonMessages.innerHTML = '<p>Starting recognition process...</p>';

    });

    // Listen for messages from Python script
    window.electronAPI.onPythonError((message) => {
        const p = document.createElement('p');
        p.className = 'error';
        p.textContent = `Error: ${message}`;
        pythonMessages.appendChild(p);
        startButton.disabled = false; // Re-enable button on error
    });

    window.electronAPI.onRecognitionFinished((message) => {
        const p = document.createElement('p');
        p.className = 'success';
        p.textContent = message;
        pythonMessages.appendChild(p);
        startButton.disabled = false; // Re-enable button
    });

    // Clean up listeners when the page is about to be unloaded
    // This is important if you navigate away and back to this page.
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllPythonErrorListeners();
        window.electronAPI.removeAllRecognitionFinishedListeners();
    });
});