// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsChartTools as operations } from 'ooxml-core/pptx/automation';
export type UpdateChartParams = operations.UpdateChartParams;
export const updateChart = operations.updateChart;
export type AddChartSeriesParams = operations.AddChartSeriesParams;
export const addChartSeriesT = operations.addChartSeriesT;
export type RemoveChartSeriesParams = operations.RemoveChartSeriesParams;
export const removeChartSeriesT = operations.removeChartSeriesT;
export type UpdateChartSeriesDataParams = operations.UpdateChartSeriesDataParams;
export const updateChartSeriesData = operations.updateChartSeriesData;
export type CreateChartParams = operations.CreateChartParams;
export type CreateChartResult = operations.CreateChartResult;
export const createChart = operations.createChart;
