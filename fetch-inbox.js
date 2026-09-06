async function run() {
  const res = await fetch("http://localhost:3000/api/v1/approvals/inbox?queue=manager&limit=25", {
    headers: {
      "Cookie": "dev-principal=102"
    }
  });
  const text = await res.text();
  console.log(res.status);
  console.log(text);
}
run();
