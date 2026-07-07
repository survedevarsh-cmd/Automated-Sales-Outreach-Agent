async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://tesla.com' })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log(text);
  } catch (err) {
    console.error(err);
  }
}
test();
