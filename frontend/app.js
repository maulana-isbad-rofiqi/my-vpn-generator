// List region otomatis (bisa ditambah bebas)
const regions = [
    "sg", "sg2", "id", "jp", "us", "my", "de", "uk", "fr"
];

window.onload = () => {
    let el = document.getElementById("regionSelect");

    regions.forEach(r => {
        let opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r.toUpperCase();
        el.appendChild(opt);
    });
};

async function generateSub() {
    const region = document.getElementById("regionSelect").value;

    const url =
`https://vpn-generator.isbadd84.workers.dev/sub?limit=10&domain=vpn-generator.isbadd84.workers.dev&region=${region}`;

    document.getElementById("result").textContent = "Loading...";

    const req = await fetch(url);
    const text = await req.text();

    document.getElementById("result").textContent = text;
}

function copyResult() {
    const text = document.getElementById("result").textContent;
    navigator.clipboard.writeText(text);
    alert("Copied!");
}
