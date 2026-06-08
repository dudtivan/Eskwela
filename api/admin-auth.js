export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin } = req.body;

  if (pin && pin === process.env.ADMIN_PIN) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
}
