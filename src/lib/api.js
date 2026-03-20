const url = import.meta.env.VITE_FUNCTIONS_URL;

export const callFunction = async (data) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
};