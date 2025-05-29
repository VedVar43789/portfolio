import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// Global variables for scales and data
let xScale, yScale;
let commits;
let commitProgress = 100;
let timeScale;
let commitMaxTime;

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line),
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
  
    return data;
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d)
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, y0] = selection[0];
  const [x1, y1] = selection[1];
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  if (countElement) {
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  }

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');
  
  if (!container) return;

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);
  
  // Add total commits
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);
  
  // Calculate number of unique files
  const uniqueFiles = new Set(data.map(d => d.file)).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(uniqueFiles);
  
  // Calculate maximum file length (in lines)
  const fileLineCounts = d3.rollup(data, v => v.length, d => d.file);
  const maxFileLines = d3.max(Array.from(fileLineCounts.values()));
  dl.append('dt').text('Max file length');
  dl.append('dd').text(maxFileLines);
  
  // Calculate longest line length
  const maxLineLength = d3.max(data, d => d.length);
  dl.append('dt').text('Longest line');
  dl.append('dd').text(maxLineLength);
  
  // Calculate maximum depth
  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth);
  
  // Calculate time of day most work is done
  const hourCounts = d3.rollup(commits, v => v.length, d => Math.floor(d.hourFrac));
  const busyHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  const timeOfDay = busyHour < 12 ? 'morning' : busyHour < 17 ? 'afternoon' : busyHour < 21 ? 'evening' : 'night';
  dl.append('dt').text('Most active time');
  dl.append('dd').text(timeOfDay);
}

// Function to render tooltip content
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  
  // Add additional elements if present in HTML
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');
  
  if (time) time.textContent = commit.time;
  if (author) author.textContent = commit.author;
  if (lines) lines.textContent = commit.totalLines;
}

// Function to update tooltip visibility
function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  
  if (isVisible) {
    tooltip.classList.add('visible');
    tooltip.hidden = false;
  } else {
    tooltip.classList.remove('visible');
    // Use a timeout to allow the CSS transition to complete before hiding
    setTimeout(() => {
      if (!tooltip.classList.contains('visible')) {
        tooltip.hidden = true;
      }
    }, 200);
  }
}

// Function to update tooltip position
function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  
  const x = event.pageX || event.clientX;
  const y = event.pageY || event.clientY;
  
  // Position tooltip near the cursor
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };
  
  // Calculate usable area first
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  
  // Create SVG container
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Define scales with proper ranges from the beginning - now assigning to global variables
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);
    
  // Calculate the range of edited lines across all commits
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  
  // Create a square root scale for the radius to ensure area is proportional to line count
  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 20]); // Adjusted range for appropriate dot sizes

  // Add gridlines BEFORE the axes
  const gridlines = svg
  .append('g')
  .attr('class', 'gridlines')
  .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
  .axisLeft(yScale)
  .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // Sort commits by total lines in descending order so smaller dots are drawn on top
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Add dots with tooltip event handlers
  const dots = svg.append('g').attr('class', 'dots');
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 1) // Full opacity on hover
        .attr('stroke', 'var(--color-accent)')
        .attr('stroke-width', 2);
      
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 0.7)
        .attr('stroke', 'none');
      
      updateTooltipVisibility(false);
    });
    createBrushSelector(svg);
}

// New: updateScatterPlot for filtered data
function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const svg = d3.select('#chart').select('svg');
  if (!commits.length) {
    // Remove all dots and clear the x-axis
    svg.select('g.dots').selectAll('circle').remove();
    svg.select('g.x-axis').selectAll('*').remove();
    return;
  }

  // Update xScale domain
  xScale.domain(d3.extent(commits, (d) => d.datetime));

  // Update rScale
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 20]);

  // Update x-axis
  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  // Update dots
  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// Will get updated as user changes slider
let filteredCommits;

function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);
  // Update <time> element
  const timeElem = document.getElementById('commit-time');
  if (timeElem) {
    timeElem.textContent = commitMaxTime.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });
  }
  // Filter commits and data
  filteredCommits = commits.filter((c) => c.datetime <= commitMaxTime);
  const filteredData = data.filter(d => d.datetime <= commitMaxTime);
  // Update stats and scatter plot
  d3.select('#stats').selectAll('*').remove();
  renderCommitInfo(filteredData, filteredCommits);
  updateScatterPlot(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  // Create a color scale for technology type
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').html('<code></code><small></small>');
          div.append('dd');
        })
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  // For each file, append one div for each line, colored by type
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

let data = await loadData();
commits = processCommits(data);

timeScale = d3.scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
commitMaxTime = timeScale.invert(commitProgress);

// Render the initial plot and stats
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
updateFileDisplay(commits);

// Initialize slider and time display
const slider = document.getElementById('commit-progress');
if (slider) {
  slider.addEventListener('input', onTimeSliderChange);
}
onTimeSliderChange();

filteredCommits = commits;

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
    On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
    I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
    I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
    Then I looked over all I had made, and I saw that it was very good.`
  )
  .style('padding-bottom', '3em');

function onStepEnter(response) {
  const commit = response.element.__data__;
  const commitDate = commit.datetime;
  
  // Update the visualization to show commits up to this date
  commitMaxTime = commitDate;
  filteredCommits = commits.filter((c) => c.datetime <= commitMaxTime);
  const filteredData = data.filter(d => d.datetime <= commitMaxTime);
  
  // Update visualizations
  d3.select('#stats').selectAll('*').remove();
  renderCommitInfo(filteredData, filteredCommits);
  updateScatterPlot(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

// Initial state
filteredCommits = commits;