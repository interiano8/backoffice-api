export interface IReportsUseCase {
  getSalesDeclaration(
    startDate: string,
    endDate: string,
    type: 'resumido' | 'detallado',
    storeCode?: string,
  ): Promise<any>;
}
