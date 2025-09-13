import { apiRequest } from "@/lib/queryClient";
import type { SettingsDTO } from "@shared/schema";

/**
 * Get policies settings
 * Returns unified settings data from brand configurations, policies, and content criteria
 */
export async function getPoliciesSettings(): Promise<SettingsDTO> {
  const response = await apiRequest("GET", "/api/policies/settings");
  return await response.json();
}

/**
 * Update policies settings
 * Updates unified settings data across brand configurations, policies, and content criteria
 */
export async function updatePoliciesSettings(payload: SettingsDTO): Promise<SettingsDTO> {
  const response = await apiRequest("PUT", "/api/policies/settings", payload);
  return await response.json();
}