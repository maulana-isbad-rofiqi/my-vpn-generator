const regions = [
  "sg", "sg2", "id", "jp", "us", "my",
  "uk", "de", "fr", "au", "in"
];

window.onload = () => {
    let select = document.getElementById("regionSelect");

    regions.forEach(r => {
        let option = document.createElement("option");
        option.value = r;
        option.textContent = r.toUpperCase();
        select.appendChild(option);
    });
};

async function loadRegion() {
    const region = document.getElementById("regionSelect").value;

    document.getElementById("result").textContent = "Loading...";

    const res = await fetch(`/api/region?region=${region}`);
    const text = await res.text();

    document.getElementById("result").textContent = text;
}

function copyResult() {
    const text = document.getElementById("result").textContent;
    navigator.clipboard.writeText(text);
    alert("Config berhasil disalin!");
}
