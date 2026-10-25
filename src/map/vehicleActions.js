// Un mismo contrato para el DOM de Google Maps y la hoja React.
export function vehicleActions(vehicle, capabilities) {
  const can = (name) => Array.isArray(capabilities) ? capabilities.includes(name) : capabilities?.[name] === true;
  const id = encodeURIComponent(vehicle.id);
  const mode = vehicle.current_mode;
  const phoneType = ["Phone", "Congelador"].includes(vehicle.device_type);
  const actions = [];
  const add = (label, icon, href, extra = {}) => actions.push({ label, icon, href, ...extra });
  if (can("fleet.command") && mode !== "STOP" && !phoneType) add("Detener motor", "power", `/gui/home/stop/${id}`, { warning: true });
  if (can("fleet.command") && ["SMS", "STOP"].includes(mode)) add("Activar", "play", `/gui/home/activate/${id}`);
  if (vehicle.sim_assigned) {
    if (Number(vehicle.monitor_mode) === 1) add("Llamar a cabina", "phone", `tel:${vehicle.sim_assigned}`);
    if (phoneType) add("Llamar", "phone", `tel:${vehicle.sim_assigned}`);
  }
  if (can("devices.edit")) add("Editar vehículo", "pencil", `/gui/devices/edit_device/${id}`);
  if (can("admin.view")) add("Coordenada manual", "crosshair", `/gui/devices/manual_location/${id}`, { target: "_blank" });
  return {
    actions,
    mode: ["SMS", "STOP", "VOZ"].includes(mode) ? `Modo actual: ${mode}` : null,
    technical: can("admin.view") ? `SIM: ${vehicle.sim_assigned || "—"} · Empresa: ${vehicle.company_name || "—"} · IMEI: ${vehicle.imei || "—"}` : null,
  };
}
