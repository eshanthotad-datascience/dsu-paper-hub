export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const start = Date.now();
  try {
    const res = await fetch('https://ums.mydsi.org/Login.aspx/DSU', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    const text = await res.text();
    return new Response(JSON.stringify({
      success: true,
      status: res.status,
      time: Date.now() - start,
      hasViewState: text.includes('__VIEWSTATE')
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      time: Date.now() - start
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
