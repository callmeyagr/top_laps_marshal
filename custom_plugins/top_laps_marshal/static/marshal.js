console.log("TopLapsMarshal: SCRIPT LOADED");

(function() {
    var allLapsCache = {};
    var currentClassId = null;
    var sessionToken = 0;
    var formatCache = {};
    var classCache = {};
    var showAllClasses = false;
    var pluginOptions = {
        skip_laps: 0,
        skip_rounds: 0,
        suspicious_iqr: 1.5,
        suspicious_pct: 25.0,
        suspicious_sec: 1.0,
        window_size: 10
    };

    function initSettingsUI() {
        var iqrInput = document.getElementById("top-laps-thr-iqr");
        var pctInput = document.getElementById("top-laps-thr-pct");
        var secInput = document.getElementById("top-laps-thr-sec");
        var resetBtn = document.getElementById("top-laps-thr-reset");
        var toggleBtn = document.getElementById("top-laps-toggle-chart");
        
        if (!iqrInput || !pctInput || !secInput || !resetBtn || !toggleBtn) return;
        
        // Загружаем сохранённые значения порогов из localStorage
        var savedIqr = localStorage.getItem("topLapsMarshal_thr_iqr");
        var savedPct = localStorage.getItem("topLapsMarshal_thr_pct");
        var savedSec = localStorage.getItem("topLapsMarshal_thr_sec");
        
        if (savedIqr !== null) {
            iqrInput.value = savedIqr;
            pluginOptions.suspicious_iqr = parseFloat(savedIqr) || 1.5;
        }
        if (savedPct !== null) {
            pctInput.value = savedPct;
            pluginOptions.suspicious_pct = parseFloat(savedPct) || 25.0;
        }
        if (savedSec !== null) {
            secInput.value = savedSec;
            pluginOptions.suspicious_sec = parseFloat(savedSec) || 1.0;
        }
        
        function applyThresholds() {
            pluginOptions.suspicious_iqr = parseFloat(iqrInput.value) || 1.5;
            pluginOptions.suspicious_pct = parseFloat(pctInput.value) || 25.0;
            pluginOptions.suspicious_sec = parseFloat(secInput.value) || 1.0;
            localStorage.setItem("topLapsMarshal_thr_iqr", pluginOptions.suspicious_iqr);
            localStorage.setItem("topLapsMarshal_thr_pct", pluginOptions.suspicious_pct);
            localStorage.setItem("topLapsMarshal_thr_sec", pluginOptions.suspicious_sec);
            var pilotId = getPilotId();
            if (pilotId && allLapsCache[pilotId]) {
                displayTopLaps(pilotId);
            }
        }
        
        iqrInput.addEventListener("change", applyThresholds);
        pctInput.addEventListener("change", applyThresholds);
        secInput.addEventListener("change", applyThresholds);
        
        resetBtn.addEventListener("click", function() {
            iqrInput.value = "1.5";
            pctInput.value = "25";
            secInput.value = "1.0";
            applyThresholds();
        });
        
        // Переключатель графика
        var savedChartVisible = localStorage.getItem("topLapsMarshal_chartVisible");
        var chartVisible = (savedChartVisible === "true");
        
        toggleBtn.textContent = chartVisible ? "Hide chart" : "Show chart";
        toggleBtn.setAttribute("data-visible", chartVisible ? "true" : "false");
        
        toggleBtn.addEventListener("click", function() {
            var current = toggleBtn.getAttribute("data-visible") === "true";
            var newVisible = !current;
            toggleBtn.setAttribute("data-visible", newVisible ? "true" : "false");
            toggleBtn.textContent = newVisible ? "Hide chart" : "Show chart";
            localStorage.setItem("topLapsMarshal_chartVisible", newVisible ? "true" : "false");
            
            var canvas = document.getElementById("top-laps-progression");
            if (canvas) {
                if (newVisible) {
                    var pilotId = getPilotId();
                    if (pilotId && allLapsCache[pilotId]) {
                        displayTopLaps(pilotId);
                    }
                } else {
                    canvas.style.display = "none";
                }
            }
        });
    }

    function createPanel() {
        if (document.getElementById("top-laps-panel")) return;

        var saved = localStorage.getItem("topLapsMarshal_showAllClasses");
        showAllClasses = (saved === "true");

        var panel = document.createElement("div");
        panel.id = "top-laps-panel";
        panel.className = "panel panel-default";
        panel.style.cssText = "margin-bottom: 15px;";
        panel.innerHTML = 
            '<div class="panel-heading">' +
                '<h3 class="panel-title" style="display: inline-block;">Top 3 Best Laps</h3>' +
                '<div style="float: right; margin-top: -3px;">' +
                    '<label style="font-weight: normal; font-size: 12px; margin-right: 10px; cursor: pointer;">' +
                        '<input type="radio" name="top-laps-class-filter" value="current" ' + (!showAllClasses ? 'checked' : '') + ' style="margin-right: 3px;">' +
                        'Current class' +
                    '</label>' +
                    '<label style="font-weight: normal; font-size: 12px; cursor: pointer;">' +
                        '<input type="radio" name="top-laps-class-filter" value="all" ' + (showAllClasses ? 'checked' : '') + ' style="margin-right: 3px;">' +
                        'All classes' +
                    '</label>' +
                '</div>' +
            '</div>' +
            '<div class="panel-body" style="clear: both;">' +
            '<div id="top-laps-settings" style="margin-bottom: 10px; font-size: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">' +
                '<span style="color: #666; font-weight: bold;">Thresholds:</span>' +
                '<label style="font-weight: normal; color: #555; margin: 0;">IQR <input type="number" id="top-laps-thr-iqr" step="0.1" min="0.1" value="1.5" style="width: 55px; padding: 2px 4px;"></label>' +
                '<label style="font-weight: normal; color: #555; margin: 0;">% <input type="number" id="top-laps-thr-pct" step="1" min="1" value="25" style="width: 55px; padding: 2px 4px;"></label>' +
                '<label style="font-weight: normal; color: #555; margin: 0;">sec <input type="number" id="top-laps-thr-sec" step="0.1" min="0.1" value="1.0" style="width: 55px; padding: 2px 4px;"></label>' +
                '<button id="top-laps-thr-reset" class="btn btn-default btn-xs">Reset</button>' +
                '<span style="flex-grow: 1;"></span>' +
                '<button id="top-laps-toggle-chart" class="btn btn-default btn-xs">Show chart</button>' +
            '</div>' +
            '<table class="table table-condensed table-striped" style="margin-bottom: 0;">' +
            '<thead><tr><th>#</th><th>Lap Time</th><th>Δ Median</th><th>Class / Group / Round</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>1</td><td id="lap1-time">--</td><td id="lap1-delta">--</td><td id="lap1-source">--</td></tr>' +
            '<tr><td>2</td><td id="lap2-time">--</td><td id="lap2-delta">--</td><td id="lap2-source">--</td></tr>' +
            '<tr><td>3</td><td id="lap3-time">--</td><td id="lap3-delta">--</td><td id="lap3-source">--</td></tr>' +
            '</tbody></table>' +
            '<div id="top-laps-stats" style="margin-top: 10px; font-size: 14px; font-weight: bold; color: #555; cursor: help; text-decoration: underline dotted;">' +
                'Median: -- · IQR: -- · Total laps: --' +
            '</div>' +
            '<div id="top-laps-chart-wrap" style="position: relative; margin-top: 8px;">' +
                '<canvas id="top-laps-progression" style="width: 100%; height: 160px; display: none;"></canvas>' +
                '<div id="top-laps-tooltip" style="position: absolute; pointer-events: none; display: none; ' +
                    'background: rgba(0,0,0,0.85); color: #fff; padding: 4px 8px; border-radius: 4px; ' +
                    'font-size: 12px; white-space: nowrap; z-index: 1000;"></div>' +
            '</div>' +
            '</div>';

        var raceView = document.getElementById("race-view");
        var raceGraph = document.getElementById("race-graph");

        if (raceView && raceGraph) {
            raceGraph.parentNode.insertBefore(panel, raceGraph);
            console.log("TopLapsMarshal: panel inserted");
        }

        var radios = panel.querySelectorAll('input[name="top-laps-class-filter"]');
        radios.forEach(function(radio) {
            radio.addEventListener("change", function() {
                if (this.checked) {
                    showAllClasses = (this.value === "all");
                    localStorage.setItem("topLapsMarshal_showAllClasses", showAllClasses ? "true" : "false");
                    var pilotId = getPilotId();
                    if (pilotId) {
                        delete allLapsCache[pilotId];
                        handleSelectionChange(pilotId);
                    }
                }
            });
        });

        initSettingsUI();
        loadMetadata();
        addSelectListeners();
    }

    function loadMetadata() {
        fetch("/top_laps_marshal/metadata")
            .then(function(r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function(data) {
                if (data.error) {
                    console.error("TopLapsMarshal: metadata error from server:", data.error);
                    return;
                }
                if (data.formats) formatCache = data.formats;
                if (data.classes) classCache = data.classes;
                // Если пользователь не задал пороги в UI — берём значения с сервера
                if (data.options) {
                    pluginOptions.skip_laps = data.options.skip_laps;
                    pluginOptions.skip_rounds = data.options.skip_rounds;
                    pluginOptions.window_size = data.options.window_size;
                    // Пороги: приоритет — localStorage (если пользователь задал), иначе сервер
                    var savedIqr = localStorage.getItem("topLapsMarshal_thr_iqr");
                    var savedPct = localStorage.getItem("topLapsMarshal_thr_pct");
                    var savedSec = localStorage.getItem("topLapsMarshal_thr_sec");
                    if (savedIqr !== null) {
                        pluginOptions.suspicious_iqr = parseFloat(savedIqr) || data.options.suspicious_iqr;
                    } else {
                        pluginOptions.suspicious_iqr = data.options.suspicious_iqr;
                    }
                    if (savedPct !== null) {
                        pluginOptions.suspicious_pct = parseFloat(savedPct) || data.options.suspicious_pct;
                    } else {
                        pluginOptions.suspicious_pct = data.options.suspicious_pct;
                    }
                    if (savedSec !== null) {
                        pluginOptions.suspicious_sec = parseFloat(savedSec) || (data.options.suspicious_sec || 1.0);
                    } else {
                        pluginOptions.suspicious_sec = data.options.suspicious_sec || 1.0;
                    }
                }
                console.log("TopLapsMarshal: metadata loaded", {
                    formats: Object.keys(formatCache).length,
                    classes: Object.keys(classCache).length,
                    options: pluginOptions
                });
            })
            .catch(function(e) {
                console.error("TopLapsMarshal: failed to load metadata:", e);
            });
    }

    function getPilotId() {
        var pilotSelect = document.getElementById("selected_pilot");
        if (!pilotSelect) return null;
        var option = pilotSelect.options[pilotSelect.selectedIndex];
        if (!option) return null;
        var id = option.getAttribute("data-pilot-id");
        return id ? parseInt(id) : null;
    }

    function getCurrentHeatId() {
        var heatSelect = document.getElementById("selected_heat");
        if (!heatSelect) return null;
        var val = heatSelect.value;
        return val ? parseInt(val) : null;
    }

    function waitForRaceList(callback) {
        if (window.race_list && window.race_list.heats) {
            callback();
            return;
        }
        var check = setInterval(function() {
            if (window.race_list && window.race_list.heats) {
                clearInterval(check);
                callback();
            }
        }, 300);
        setTimeout(function() { clearInterval(check); }, 30000);
    }

    function addSelectListeners() {
        var pilotSelect = document.getElementById("selected_pilot");
        var heatSelect = document.getElementById("selected_heat");

        if (pilotSelect) {
            pilotSelect.addEventListener("change", function() {
                var pilotId = getPilotId();
                if (!pilotId) return;
                setTimeout(function() { handleSelectionChange(getPilotId()); }, 200);
            });
        }
        if (heatSelect) {
            heatSelect.addEventListener("change", function() {
                var pilotId = getPilotId();
                if (!pilotId) return;
                setTimeout(function() { handleSelectionChange(getPilotId()); }, 200);
            });
        }
        if (pilotSelect) {
            var observer = new MutationObserver(function() {
                var pilotId = getPilotId();
                if (pilotId && !allLapsCache[pilotId]) {
                    observer.disconnect();
                    handleSelectionChange(pilotId);
                }
            });
            observer.observe(pilotSelect, { childList: true, subtree: true });
        }
    }

    function handleSelectionChange(pilotId) {
        var heatId = getCurrentHeatId();
        if (!heatId || !pilotId) {
            clearTable();
            return;
        }
        var currentPilot = getPilotId();
        if (currentPilot !== pilotId) return;

        clearTable();
        sessionToken++;
        var myToken = sessionToken;

        if (window.race_args && window.race_args.class_id !== undefined) {
            currentClassId = window.race_args.class_id;
            loadLapsFromRaceList(pilotId, myToken);
        } else {
            fetch("/api/heat/" + heatId)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (myToken !== sessionToken) return;
                    if (data && data.heat && data.heat.setup) {
                        currentClassId = data.heat.setup.class_id;
                    }
                    loadLapsFromRaceList(pilotId, myToken);
                });
        }
    }

    function clearTable() {
        for (var i = 1; i <= 3; i++) {
            var timeEl = document.getElementById("lap" + i + "-time");
            var deltaEl = document.getElementById("lap" + i + "-delta");
            var sourceEl = document.getElementById("lap" + i + "-source");
            if (timeEl) timeEl.textContent = "...";
            if (deltaEl) { deltaEl.textContent = "..."; deltaEl.style.color = ""; deltaEl.style.fontWeight = ""; deltaEl.style.fontStyle = ""; deltaEl.title = ""; }
            if (sourceEl) sourceEl.textContent = "...";
        }
        var statsEl = document.getElementById("top-laps-stats");
        if (statsEl) {
            statsEl.textContent = "Median: -- · IQR: -- · Total laps: --";
            statsEl.title = "";
        }
        var canvas = document.getElementById("top-laps-progression");
        if (canvas) {
            canvas.style.display = "none";
            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        }
        var tooltip = document.getElementById("top-laps-tooltip");
        if (tooltip) tooltip.style.display = "none";
    }

    function loadLapsFromRaceList(pilotId, myToken) {
        waitForRaceList(function() {
            if (myToken !== sessionToken) return;

            allLapsCache[pilotId] = {};
            var cache = allLapsCache[pilotId];

            var heats = window.race_list.heats;
            var requests = [];

            for (var heatId in heats) {
                var heat = heats[heatId];
                if (!showAllClasses && currentClassId && heat.class_id !== currentClassId) continue;

                var heatName = heat.displayname || ("Heat " + heatId);
                var className = classCache[heat.class_id] || ("Class " + heat.class_id);

                for (var roundId in heat.rounds) {
                    var round = heat.rounds[roundId];
                    var pilotInRound = false;
                    if (round.pilotraces) {
                        for (var i = 0; i < round.pilotraces.length; i++) {
                            if (round.pilotraces[i].pilot_id === pilotId) {
                                pilotInRound = true;
                                break;
                            }
                        }
                    }
                    if (!pilotInRound) continue;

                    requests.push({
                        heat_id: parseInt(heatId),
                        round_id: parseInt(roundId),
                        heat_name: heatName,
                        class_id: heat.class_id,
                        class_name: className,
                        format_id: round.format_id,
                        start_time: round.start_time || 0
                    });
                }
            }

            requests.sort(function(a, b) { return a.start_time - b.start_time; });

            var skipRounds = pluginOptions.skip_rounds || 0;
            requests.forEach(function(req, idx) {
                req.ignore_in_stats = (idx < skipRounds);
            });

            if (requests.length === 0) {
                if (myToken === sessionToken) displayTopLaps(pilotId);
                return;
            }

            var pending = requests.length;

            requests.forEach(function(req) {
                var url = "/api/race/" + req.heat_id + "/" + req.round_id;
                fetch(url)
                    .then(function(r) { if (!r.ok) return null; return r.json(); })
                    .then(function(data) {
                        if (myToken !== sessionToken) return;
                        if (data) processHeatData(pilotId, req, data, cache);
                    })
                    .catch(function(e) {})
                    .finally(function() {
                        pending--;
                        if (pending === 0 && myToken === sessionToken) {
                            displayTopLaps(pilotId);
                        }
                    });
            });
        });
    }

    function processHeatData(pilotId, req, data, cache) {
        if (!data || !data.race || !data.race.nodes) return;

        var roundLabel = req.class_name + " / " + req.heat_name + " / Round " + req.round_id;
        var startBehavior = formatCache[req.format_id];
        var skipFirstValidLap = (startBehavior === 0);

        data.race.nodes.forEach(function(node) {
            if (node.pilot_id !== pilotId) return;
            if (!node.laps) return;

            var validLaps = node.laps.filter(function(lap) { return !lap.deleted; });

            validLaps.forEach(function(lap, validIndex) {
                if (skipFirstValidLap && validIndex === 0) return;

                var key = "lap_" + lap.id;
                if (!cache[key]) {
                    cache[key] = {
                        lap_id: lap.id,
                        lap_time: lap.lap_time,
                        lap_time_formatted: lap.lap_time_formatted,
                        lap_time_stamp: lap.lap_time_stamp,
                        round: roundLabel,
                        heat_id: req.heat_id,
                        round_id: req.round_id,
                        class_id: req.class_id,
                        class_name: req.class_name,
                        start_time: req.start_time,
                        ignore_in_stats: req.ignore_in_stats
                    };
                }
            });
        });
    }

    function formatTime(ms) {
        var totalSeconds = ms / 1000;
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = (totalSeconds % 60).toFixed(3);
        if (seconds < 10) seconds = "0" + seconds;
        return minutes + ":" + seconds;
    }

    function percentile(sortedArr, p) {
        var len = sortedArr.length;
        if (len === 0) return 0;
        if (len === 1) return sortedArr[0];
        var idx = (len - 1) * p;
        var lower = Math.floor(idx);
        var upper = Math.ceil(idx);
        if (lower === upper) return sortedArr[lower];
        return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
    }

    function computeBoxPlotStats(times) {
        if (times.length === 0) {
            return {
                clean: { median: 0, q1: 0, q3: 0, iqr: 0, mean: 0, min: 0, max: 0, count: 0 },
                outliers: [],
                totalCount: 0,
                lowerFence: 0,
                upperFence: 0
            };
        }
        
        var sorted = times.slice().sort(function(a, b) { return a - b; });
        var n = sorted.length;
        
        var preQ1 = percentile(sorted, 0.25);
        var preQ3 = percentile(sorted, 0.75);
        var preIQR = preQ3 - preQ1;
        var lowerFence = preQ1 - 1.5 * preIQR;
        var upperFence = preQ3 + 1.5 * preIQR;
        
        var clean = [];
        var outliers = [];
        for (var i = 0; i < n; i++) {
            if (sorted[i] < lowerFence || sorted[i] > upperFence) {
                outliers.push(sorted[i]);
            } else {
                clean.push(sorted[i]);
            }
        }
        
        var cleanStats = { median: 0, q1: 0, q3: 0, iqr: 0, mean: 0, min: 0, max: 0, count: 0 };
        if (clean.length > 0) {
            var cn = clean.length;
            cleanStats.q1 = percentile(clean, 0.25);
            cleanStats.q3 = percentile(clean, 0.75);
            cleanStats.median = percentile(clean, 0.50);
            cleanStats.iqr = cleanStats.q3 - cleanStats.q1;
            cleanStats.min = clean[0];
            cleanStats.max = clean[cn - 1];
            var sum = 0;
            for (var j = 0; j < cn; j++) sum += clean[j];
            cleanStats.mean = sum / cn;
            cleanStats.count = cn;
        }
        
        return {
            clean: cleanStats,
            outliers: outliers,
            totalCount: n,
            lowerFence: lowerFence,
            upperFence: upperFence
        };
    }

    function buildQuartiles(cleanStats, outliers, totalCount) {
        var lines = [];
        if (cleanStats.count === 0) {
            return "No clean laps after outlier removal (total: " + totalCount + ")";
        }
        function fmt(ms) { return (ms / 1000).toFixed(1) + "s"; }
        
        lines.push("Distribution by quartiles (" + cleanStats.count + " clean laps):");
        lines.push("");
        lines.push("Q1 (0–25%):   " + fmt(cleanStats.min) + " – " + fmt(cleanStats.q1));
        lines.push("Q2 (25–50%):  " + fmt(cleanStats.q1) + " – " + fmt(cleanStats.median));
        lines.push("Q3 (50–75%):  " + fmt(cleanStats.median) + " – " + fmt(cleanStats.q3));
        lines.push("Q4 (75–100%): " + fmt(cleanStats.q3) + " – " + fmt(cleanStats.max));
        lines.push("");
        if (outliers.length > 0) {
            lines.push("Outliers: " + outliers.length + " laps (" + fmt(outliers[0]) + " – " + fmt(outliers[outliers.length - 1]) + ")");
        } else {
            lines.push("Outliers: none");
        }
        return lines.join("\n");
    }

    function handleChartMouseMove(canvas, e) {
        var data = canvas._chartData;
        if (!data) return;
        
        var rect = canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        
        var tooltip = document.getElementById("top-laps-tooltip");
        if (!tooltip) return;
        
        if (mouseX < data.paddingLeft || mouseX > data.paddingLeft + data.chartW) {
            tooltip.style.display = "none";
            return;
        }
        
        var n = data.chronoLaps.length;
        var relX = (mouseX - data.paddingLeft) / data.chartW;
        var idx = Math.round(relX * (n - 1));
        idx = Math.max(0, Math.min(n - 1, idx));
        
        var lap = data.chronoLaps[idx];
        if (!lap) return;
        
        var clamped = Math.max(data.chartMin, Math.min(data.chartMax, lap.lap_time));
        var pointY = data.paddingTop + data.chartH - ((clamped - data.chartMin) / data.range) * data.chartH;
        
        if (Math.abs(mouseY - pointY) > 15) {
            tooltip.style.display = "none";
            return;
        }
        
        tooltip.innerHTML = 
            '<b>' + lap.lap_time_formatted + '</b><br>' +
            lap.round;
        
        tooltip.style.display = "block";
        
        var tooltipX = mouseX + 12;
        var tooltipY = pointY - 10;
        
        if (tooltipX + tooltip.offsetWidth > data.paddingLeft + data.chartW) {
            tooltipX = mouseX - tooltip.offsetWidth - 12;
        }
        if (tooltipY < 0) tooltipY = pointY + 10;
        
        tooltip.style.left = tooltipX + "px";
        tooltip.style.top = tooltipY + "px";
    }

    function renderProgressionChart(chronoLaps, boxStats) {
        var canvas = document.getElementById("top-laps-progression");
        if (!canvas) return;
        
        var chartVisible = (localStorage.getItem("topLapsMarshal_chartVisible") === "true");
        if (!chartVisible) {
            canvas.style.display = "none";
            return;
        }
        
        if (chronoLaps.length < 2) { canvas.style.display = "none"; return; }
        canvas.style.display = "block";
        
        var dpr = window.devicePixelRatio || 1;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        var ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        
        var stats = boxStats.clean;
        var paddingLeft = 52, paddingRight = 10, paddingTop = 10, paddingBottom = 22;
        var chartW = width - paddingLeft - paddingRight;
        var chartH = height - paddingTop - paddingBottom;
        
        var minT = Infinity, maxT = -Infinity;
        chronoLaps.forEach(function(l) {
            if (l.lap_time < minT) minT = l.lap_time;
            if (l.lap_time > maxT) maxT = l.lap_time;
        });
        var chartMax = Math.min(maxT, boxStats.upperFence * 1.5);
        var chartMin = minT;
        var range = chartMax - chartMin;
        if (range < 1) range = 1;
        
        function xPos(idx) { return paddingLeft + (idx / Math.max(1, chronoLaps.length - 1)) * chartW; }
        function yPos(t) {
            var clamped = Math.max(chartMin, Math.min(chartMax, t));
            return paddingTop + chartH - ((clamped - chartMin) / range) * chartH;
        }
        
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.strokeRect(paddingLeft, paddingTop, chartW, chartH);
        
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yPos(stats.median));
        ctx.lineTo(paddingLeft + chartW, yPos(stats.median));
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (boxStats.upperFence <= chartMax) {
            ctx.strokeStyle = "#c00";
            ctx.lineWidth = 1;
            ctx.setLineDash([1, 2]);
            ctx.beginPath();
            ctx.moveTo(paddingLeft, yPos(boxStats.upperFence));
            ctx.lineTo(paddingLeft + chartW, yPos(boxStats.upperFence));
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        chronoLaps.forEach(function(l, idx) {
            var x = xPos(idx);
            var y = yPos(l.lap_time);
            var isOutlier = (l.lap_time < boxStats.lowerFence || l.lap_time > boxStats.upperFence);
            var color;
            if (l.ignore_in_stats) color = "#ccc";
            else if (isOutlier) color = "#c00";
            else if (l.lap_time > stats.median) color = "#f0ad4e";
            else color = "#5cb85c";
            
            ctx.fillStyle = color;
            ctx.beginPath();
            if (isOutlier) {
                ctx.arc(x, y, 3.0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#800";
                ctx.lineWidth = 0.8;
                ctx.stroke();
            } else {
                ctx.arc(x, y, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        ctx.fillStyle = "#888";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        ctx.fillText((stats.min/1000).toFixed(1) + "s", paddingLeft - 6, yPos(stats.min));
        ctx.fillText((stats.median/1000).toFixed(1) + "s", paddingLeft - 6, yPos(stats.median));
        
        if (boxStats.upperFence <= chartMax) {
            ctx.fillStyle = "#c00";
            ctx.fillText((boxStats.upperFence/1000).toFixed(1) + "s", paddingLeft - 6, yPos(boxStats.upperFence));
        }
        
        ctx.fillStyle = "#888";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("0", paddingLeft, paddingTop + chartH + 5);
        ctx.fillText(Math.floor(chronoLaps.length / 2), paddingLeft + chartW / 2, paddingTop + chartH + 5);
        ctx.fillText(chronoLaps.length, paddingLeft + chartW, paddingTop + chartH + 5);
        
        ctx.textAlign = "left";
        ctx.fillStyle = "#666";
        ctx.font = "11px sans-serif";
        ctx.fillText("Each dot = 1 lap. Red = outlier. Dashed blue = median.", paddingLeft + 4, paddingTop + 12);
        
        canvas._chartData = {
            chronoLaps: chronoLaps,
            paddingLeft: paddingLeft,
            paddingTop: paddingTop,
            chartW: chartW,
            chartH: chartH,
            chartMin: chartMin,
            chartMax: chartMax,
            range: range
        };
        
        if (canvas._mouseMoveHandler) {
            canvas.removeEventListener("mousemove", canvas._mouseMoveHandler);
            canvas.removeEventListener("mouseleave", canvas._mouseLeaveHandler);
        }
        canvas._mouseMoveHandler = function(e) { handleChartMouseMove(canvas, e); };
        canvas._mouseLeaveHandler = function() {
            var tooltip = document.getElementById("top-laps-tooltip");
            if (tooltip) tooltip.style.display = "none";
        };
        canvas.addEventListener("mousemove", canvas._mouseMoveHandler);
        canvas.addEventListener("mouseleave", canvas._mouseLeaveHandler);
    }

    function displayTopLaps(pilotId) {
        var cache = allLapsCache[pilotId];
        if (!cache) return;

        var laps = Object.values(cache);
        if (laps.length === 0) { clearTable(); return; }

        var allLaps = laps.slice();
        allLaps.sort(function(a, b) { return a.lap_time - b.lap_time; });
        var top3 = allLaps.slice(0, 3);

        var statsLaps = laps.filter(function(l) { return !l.ignore_in_stats; });
        statsLaps.sort(function(a, b) {
            if (a.start_time !== b.start_time) return a.start_time - b.start_time;
            return (a.lap_time_stamp || 0) - (b.lap_time_stamp || 0);
        });
        var skipLaps = pluginOptions.skip_laps || 0;
        if (skipLaps > 0 && statsLaps.length > skipLaps) {
            statsLaps = statsLaps.slice(skipLaps);
        } else if (skipLaps > 0) {
            statsLaps = [];
        }

        var times = statsLaps.map(function(l) { return l.lap_time; });
        var boxStats = computeBoxPlotStats(times);
        var stats = boxStats.clean;

        for (var i = 0; i < 3; i++) {
            var timeEl = document.getElementById("lap" + (i+1) + "-time");
            var deltaEl = document.getElementById("lap" + (i+1) + "-delta");
            var sourceEl = document.getElementById("lap" + (i+1) + "-source");

            if (timeEl && sourceEl && deltaEl) {
                if (i < top3.length) {
                    timeEl.textContent = top3[i].lap_time_formatted;
                    sourceEl.textContent = top3[i].round;

                    if (stats.median > 0) {
                        var deltaMs = top3[i].lap_time - stats.median;
                        var deltaSec = (deltaMs / 1000).toFixed(3);
                        var deltaSecAbs = Math.abs(deltaMs / 1000);
                        var deltaPct = (deltaMs / stats.median) * 100;
                        var sign = deltaPct >= 0 ? "+" : "";
                        var iqrUnits = stats.iqr > 0 ? deltaMs / stats.iqr : 0;
                        var iqrStr = stats.iqr > 0 ? (" / " + iqrUnits.toFixed(1) + " IQR") : "";
                        
                        var isOutlier = (top3[i].lap_time < boxStats.lowerFence || top3[i].lap_time > boxStats.upperFence);
                        
                        var suspiciousIqr = Math.abs(iqrUnits) >= (pluginOptions.suspicious_iqr || 1.5);
                        var suspiciousPct = Math.abs(deltaPct) >= (pluginOptions.suspicious_pct || 25.0);
                        var suspiciousSec = deltaSecAbs >= (pluginOptions.suspicious_sec || 1.0);
                        var suspicious = suspiciousIqr && suspiciousPct && suspiciousSec;
                        
                        var warnIcon = "";
                        if (isOutlier) warnIcon = " 🚩";
                        else if (suspicious) warnIcon = " ⚠️";
                        
                        deltaEl.textContent = sign + deltaPct.toFixed(1) + "% (" + deltaSec + "s)" + iqrStr + warnIcon;
                        
                        deltaEl.style.fontStyle = "normal";
                        if (isOutlier) {
                            deltaEl.style.color = "#8b0000";
                            deltaEl.style.fontWeight = "bold";
                            deltaEl.style.fontStyle = "italic";
                        } else if (suspicious) {
                            deltaEl.style.color = "#c00";
                            deltaEl.style.fontWeight = "bold";
                        } else if (Math.abs(iqrUnits) >= 1.0 || Math.abs(deltaPct) >= 15) {
                            deltaEl.style.color = "#e67e00";
                            deltaEl.style.fontWeight = "normal";
                        } else if (deltaPct < 0) {
                            deltaEl.style.color = "#080";
                            deltaEl.style.fontWeight = "normal";
                        } else {
                            deltaEl.style.color = "#888";
                            deltaEl.style.fontWeight = "normal";
                        }
                        
                        var titleLines = [
                            "Best lap: " + top3[i].lap_time_formatted,
                            "Median (clean): " + formatTime(stats.median),
                            "IQR (clean): " + formatTime(stats.iqr),
                            "Δ from median: " + sign + deltaSec + "s (" + sign + deltaPct.toFixed(1) + "%)",
                            "Δ in IQR units: " + iqrUnits.toFixed(2) + " IQR"
                        ];
                        
                        if (isOutlier) {
                            titleLines.push("");
                            titleLines.push("🚩 This lap is an outlier (outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR]).");
                            titleLines.push("It may be a timing error or a genuinely exceptional lap.");
                            titleLines.push("Check the lap data before trusting it.");
                        } else if (suspicious) {
                            titleLines.push("");
                            titleLines.push("⚠️ Suspicious: " +
                                Math.abs(iqrUnits).toFixed(1) + "× IQR, " +
                                Math.abs(deltaPct).toFixed(1) + "% from median, " +
                                deltaSecAbs.toFixed(2) + "s absolute");
                        } else {
                            titleLines.push("");
                            titleLines.push("Not flagged (need all three: IQR ≥ " +
                                (pluginOptions.suspicious_iqr || 1.5) + ", pct ≥ " +
                                (pluginOptions.suspicious_pct || 25) + "%, sec ≥ " +
                                (pluginOptions.suspicious_sec || 1.0) + "s)");
                        }
                        
                        deltaEl.title = titleLines.join("\n");
                    } else {
                        deltaEl.textContent = "--";
                    }
                } else {
                    timeEl.textContent = "--";
                    deltaEl.textContent = "--";
                    sourceEl.textContent = "--";
                }
            }
        }

        var statsEl = document.getElementById("top-laps-stats");
        if (statsEl) {
            var skippedInfo = "";
            if (pluginOptions.skip_rounds > 0 || pluginOptions.skip_laps > 0) {
                skippedInfo = " (stats on " + stats.count + " laps)";
            }
            statsEl.textContent = 
                'Median: ' + formatTime(stats.median) + 
                ' · IQR: ' + formatTime(stats.iqr) + 
                ' · Total laps: ' + laps.length + skippedInfo;
            
            var quartiles = buildQuartiles(boxStats.clean, boxStats.outliers, boxStats.totalCount);
            statsEl.title = 
                "Median: " + formatTime(stats.median) + "\n" +
                "Mean: " + formatTime(stats.mean) + "\n" +
                "Min (clean): " + formatTime(stats.min) + "\n" +
                "Max (clean): " + formatTime(stats.max) + "\n\n" +
                quartiles + "\n\n" +
                "─── Methodology ───\n" +
                "Median — middle lap time (50% faster, 50% slower)\n" +
                "IQR — interquartile range (Q3 − Q1): spread of the middle 50% of clean laps\n" +
                "Outliers — laps outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR], excluded from stats (box plot method)\n" +
                "Δ in IQR units = (lap − median) / IQR\n" +
                "⚠️ — flagged only when ALL three thresholds are met:\n" +
                "     |IQR units| ≥ " + (pluginOptions.suspicious_iqr || 1.5) + ", " +
                "|Δ %| ≥ " + (pluginOptions.suspicious_pct || 25) + "%, " +
                "|Δ sec| ≥ " + (pluginOptions.suspicious_sec || 1.0) + "s\n" +
                "🚩 — lap is a box-plot outlier (may be timing error)\n" +
                (pluginOptions.skip_rounds > 0 ? "Stats skip first " + pluginOptions.skip_rounds + " rounds (by time)\n" : "") +
                (pluginOptions.skip_laps > 0 ? "Stats skip first " + pluginOptions.skip_laps + " laps (by time)\n" : "");
        }

        var chronologicalLaps = laps.slice();
        chronologicalLaps.sort(function(a, b) {
            if (a.start_time !== b.start_time) return a.start_time - b.start_time;
            return (a.lap_time_stamp || 0) - (b.lap_time_stamp || 0);
        });

        renderProgressionChart(chronologicalLaps, boxStats);
    }

    function reloadPilotCache(pilotId) {
        if (!pilotId) return;
        delete allLapsCache[pilotId];
        handleSelectionChange(pilotId);
    }

    function watchActionButtons() {
        var saveBtn = document.getElementById("save-laps");
        var addLapBtn = document.getElementById("add-lap");
        var cleanBtn = document.getElementById("clean-laps");
        var discardBtn = document.getElementById("discard-laps");

        if (!saveBtn) {
            setTimeout(watchActionButtons, 1000);
            return;
        }

        function reload() {
            var pilotId = getPilotId();
            if (!pilotId) return;
            setTimeout(function() { reloadPilotCache(pilotId); }, 1000);
        }

        if (saveBtn) saveBtn.addEventListener("click", reload);
        if (addLapBtn) addLapBtn.addEventListener("click", reload);
        if (cleanBtn) cleanBtn.addEventListener("click", reload);
        if (discardBtn) discardBtn.addEventListener("click", reload);
    }

    watchActionButtons();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createPanel);
    } else {
        createPanel();
    }
})();