// console.log("IT'S ALIVE!");

// function $$(selector, context = document) {
//   return Array.from(context.querySelectorAll(selector));
// }

// // Step 2: Highlight the current page link
// const navLinks = $$("nav a");

// const currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname
// );

// currentLink?.classList.add("current");

console.log("IT'S ALIVE!");


function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}


let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/VedVar43789", title: "GitHub" }
];

const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/"; // 

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
    let url = p.url;
    let title = p.title;
  
    url = !url.startsWith("http") ? BASE_PATH + url : url;
  
    let a = document.createElement("a");
    a.href = url;
    a.textContent = title;
  
    a.classList.toggle(
      "current",
      a.host === location.host && a.pathname === location.pathname
    );
  
    if (a.host !== location.host) {
      a.target = "_blank";
    }
  
    nav.append(a);
  }

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select id="theme-select">
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    `
  );

  const select = document.querySelector("#theme-select");

if ("colorScheme" in localStorage) {
  const savedScheme = localStorage.colorScheme;
  document.documentElement.style.setProperty("color-scheme", savedScheme);
  select.value = savedScheme;
}

select.addEventListener("input", function (event) {
  const value = event.target.value;
  console.log("Color scheme changed to", value);
  document.documentElement.style.setProperty("color-scheme", value);
  localStorage.colorScheme = value;
});

const form = document.querySelector("form");

form?.addEventListener("submit", function (event) {
  event.preventDefault(); 

  const data = new FormData(form);
  let url = form.action + "?";
  const params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  url += params.join("&");

  location.href = url;
});



  

