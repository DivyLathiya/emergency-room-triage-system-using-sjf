// Patient array to store input
let patients = [];

// Form submission handler
document.getElementById('patient-form').addEventListener('submit', function (e) {
    e.preventDefault();
    
    const patientId = document.getElementById('patient-id').value.trim();
    const arrivalTime = document.getElementById('arrival-time').value.trim();
    const treatmentTime = parseInt(document.getElementById('treatment-time').value);
    const criticality = document.getElementById('criticality').value;

    // Validate inputs
    if (!patientId) {
        alert('Patient ID cannot be empty');
        return;
    }
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(arrivalTime)) {
        alert('Please enter a valid arrival time (HH:MM)');
        return;
    }
    if (isNaN(treatmentTime) || treatmentTime <= 0) {
        alert('Treatment time must be a positive number');
        return;
    }

    // Add patient to array
    patients.push({
        id: patientId,
        arrivalTime: arrivalTime,
        treatmentTime: treatmentTime,
        criticality: criticality,
        arrivalMinutes: timeToMinutes(arrivalTime)
    });

    // Update table with animation
    updatePatientTable();

    // Clear form
    document.getElementById('patient-form').reset();
});

// Clear patients button handler
document.getElementById('clear-btn').addEventListener('click', function () {
    if (confirm('Are you sure you want to clear all patients?')) {
        patients = [];
        updatePatientTable();
        document.getElementById('avg-waiting-time').textContent = 'Average Waiting Time: N/A';
        document.getElementById('avg-turnaround-time').textContent = 'Average Turnaround Time: N/A';
        if (window.ganttChart) {
            window.ganttChart.destroy();
        }
    }
});

// Convert HH:MM to minutes since midnight
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Convert minutes to HH:MM format
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Update patient table with animation
function updatePatientTable() {
    const tbody = document.getElementById('patient-table-body');
    tbody.innerHTML = '';
    patients.forEach(patient => {
        const row = document.createElement('tr');
        row.classList.add('new-row');
        row.innerHTML = `
            <td class="p-3">${patient.id}</td>
            <td class="p-3">${patient.arrivalTime}</td>
            <td class="p-3">${patient.treatmentTime}</td>
            <td class="p-3 ${patient.criticality === 'critical' ? 'text-red-600' : 'text-green-600'}">${patient.criticality}</td>
        `;
        tbody.appendChild(row);
        // Remove animation class after animation completes
        setTimeout(() => row.classList.remove('new-row'), 500);
    });
}

// Schedule button handler
document.getElementById('schedule-btn').addEventListener('click', function () {
    if (patients.length === 0) {
        alert('Please add at least one patient.');
        return;
    }

    // Show loading spinner
    const spinner = document.getElementById('loading-spinner');
    spinner.classList.add('active');
    this.disabled = true;

    // Simulate processing delay
    setTimeout(() => {
        // Run SJF scheduling
        const { schedule, metrics } = sjfScheduling(patients);

        // Hide spinner
        spinner.classList.remove('active');
        this.disabled = false;

        // Display Gantt chart
        renderGanttChart(schedule);

        // Display metrics
        document.getElementById('avg-waiting-time').textContent = 
            `Average Waiting Time: ${metrics.avgWaitingTime.toFixed(2)} min`;
        document.getElementById('avg-turnaround-time').textContent = 
            `Average Turnaround Time: ${metrics.avgTurnaroundTime.toFixed(2)} min`;
    }, 1000);
});

// SJF Scheduling Logic (Corrected)
function sjfScheduling(patients) {
    // Separate critical and non-critical patients
    const critical = patients.filter(p => p.criticality === 'critical');
    const nonCritical = patients.filter(p => p.criticality === 'non-critical');

    // Sort by arrival time for both
    critical.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);
    nonCritical.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);

    let currentTime = Math.min(...patients.map(p => p.arrivalMinutes));
    const schedule = [];
    let waitingTimes = [];
    let turnaroundTimes = [];

    // Process critical patients first
    critical.forEach(patient => {
        const startTime = Math.max(currentTime, patient.arrivalMinutes);
        schedule.push({
            id: patient.id,
            start: startTime,
            end: startTime + patient.treatmentTime,
            criticality: patient.criticality
        });
        const turnaroundTime = startTime + patient.treatmentTime - patient.arrivalMinutes;
        const waitingTime = turnaroundTime - patient.treatmentTime;
        waitingTimes.push(waitingTime);
        turnaroundTimes.push(turnaroundTime);
        currentTime = startTime + patient.treatmentTime;
    });

    // Process non-critical patients using SJF
    let remainingNonCritical = [...nonCritical];
    while (remainingNonCritical.length > 0) {
        // Get patients who have arrived by currentTime
        const available = remainingNonCritical.filter(p => p.arrivalMinutes <= currentTime);
        
        if (available.length === 0) {
            // No patients available; advance to the next arrival
            currentTime = Math.min(...remainingNonCritical.map(p => p.arrivalMinutes));
            continue;
        }

        // Select patient with shortest treatment time
        const nextPatient = available.reduce((min, p) => 
            p.treatmentTime < min.treatmentTime || 
            (p.treatmentTime === min.treatmentTime && p.arrivalMinutes < min.arrivalMinutes) ? p : min, 
            available[0]);

        // Schedule patient
        const startTime = Math.max(currentTime, nextPatient.arrivalMinutes);
        schedule.push({
            id: nextPatient.id,
            start: startTime,
            end: startTime + nextPatient.treatmentTime,
            criticality: nextPatient.criticality
        });

        // Calculate metrics
        const turnaroundTime = (startTime + nextPatient.treatmentTime) - nextPatient.arrivalMinutes;
        const waitingTime = turnaroundTime - nextPatient.treatmentTime;
        waitingTimes.push(waitingTime);
        turnaroundTimes.push(turnaroundTime);

        // Update current time and remove patient
        currentTime = startTime + nextPatient.treatmentTime;
        remainingNonCritical = remainingNonCritical.filter(p => p !== nextPatient);
    }

    // Debug: Log schedule to verify criticality
    console.log('Schedule:', schedule);

    // Calculate average metrics
    const avgWaitingTime = waitingTimes.length > 0 ? 
        waitingTimes.reduce((sum, wt) => sum + wt, 0) / waitingTimes.length : 0;
    const avgTurnaroundTime = turnaroundTimes.length > 0 ? 
        turnaroundTimes.reduce((sum, tat) => sum + tat, 0) / turnaroundTimes.length : 0;

    return {
        schedule,
        metrics: { avgWaitingTime, avgTurnaroundTime }
    };
}

// Render Gantt Chart using Chart.js
function renderGanttChart(schedule) {
    const ctx = document.getElementById('gantt-chart').getContext('2d');
    
    // Destroy previous chart if exists
    if (window.ganttChart) {
        window.ganttChart.destroy();
    }

    // Define vibrant colors for non-critical patients
    const nonCriticalColors = [
        '#3b82f6', // Blue
        '#facc15', // Yellow
        '#22c55e', // Green
        '#a855f7' ,//Indigo
        '#ec4899', // Pink
        '#10b981'  // Emerald
    ];

    // Prepare data for Chart.js
    const datasets = schedule.map((task, index) => {
        // Assign colors: red for critical, cycle through nonCriticalColors for non-critical
        const colorIndex = index % nonCriticalColors.length;
        return {
            label: task.id,
            data: [{
                x: [task.start, task.end],
                y: 'Treatment Room'
            }],
            backgroundColor: task.criticality === 'critical' ? '#ef4444' : nonCriticalColors[colorIndex],
            borderColor: task.criticality === 'critical' ? '#b91c1c' : nonCriticalColors[colorIndex].replace('f6', 'c0').replace('15', 'c0').replace('5e', 'c0').replace('99', 'c0').replace('81', 'c0'),
            borderWidth: 1
        };
    });

    window.ganttChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Time (Minutes since 00:00)',
                        color: '#1e40af',
                        font: { size: 14 }
                    },
                    ticks: {
                        callback: function(value) {
                            return minutesToTime(value);
                        },
                        color: '#1e40af'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Resource',
                        color: '#1e40af',
                        font: { size: 14 }
                    },
                    ticks: { color: '#1e40af' }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#1e40af',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const task = schedule[context.datasetIndex];
                            return `${task.id}: ${minutesToTime(task.start)} - ${minutesToTime(task.end)}`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuad'
            }
        }
    });
}