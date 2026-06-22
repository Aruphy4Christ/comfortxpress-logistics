module.exports = (req, res, next) => {
  const key = req.headers['x-admin-key']
    || req.query.key;
  if (key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};