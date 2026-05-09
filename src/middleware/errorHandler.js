export const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({ error: "Already completed for this date" });
  }

  const status = err.status ?? 500;
  const message = err.message ?? "Internal server error";

  res.status(status).json({ error: message });
};
