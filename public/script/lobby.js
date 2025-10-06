const createBtn = document.getElementById("create_room");
const joinBtn = document.getElementById("join_room");

createBtn.addEventListener("click", async () => {
  // disable to prevent multiple clicks
  createBtn.style.pointerEvents = "none";
  createBtn.style.opacity = "0.6";

  try {
    const res = await fetch("/api/room", { method: "POST" });
    if (!res.ok) throw new Error("Failed to create room");
    const data = await res.json();
    window.location.href = `/room.html?room=${data.roomID}`;
  } catch (err) {
    console.error(err);
    window.location.href = `/error.html?type=server_error`;
  } finally {
    // re-enable if something goes wrong before redirect
    createBtn.style.pointerEvents = "auto";
    createBtn.style.opacity = "1";
  }
});

joinBtn.addEventListener("click", () => {
  // disable to prevent multiple clicks
  joinBtn.style.pointerEvents = "none";
  joinBtn.style.opacity = "0.6";

  const roomID = document
    .querySelector("#join_room input[type='number']")
    .value.trim();

  if (roomID === "" || isNaN(roomID) || roomID.length != 4) {
    joinBtn.style.pointerEvents = "auto";
    joinBtn.style.opacity = "1";
    return;
  }
    createBtn.style.pointerEvents = "auto";
    createBtn.style.opacity = "1";
  // redirect directly
  window.location.href = `/room.html?room=${roomID}`;
});
