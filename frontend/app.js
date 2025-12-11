document.getElementById("generate").onclick = async () => {
  const domain = document.getElementById("domain").value;
  const limit = document.getElementById("limit").value;

  const res = await fetch(`/api/sub?domain=${domain}&limit=${limit}`);
  const text = await res.text();

  document.getElementById("result").textContent = text;
};
