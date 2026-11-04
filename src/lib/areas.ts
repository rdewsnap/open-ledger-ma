/**
 * One plain line on what each spending area actually pays for, because an office's
 * name does not describe everything in it ("Energy & Environmental Affairs" is
 * mostly parks, environmental protection and farms, not energy). Shown beside the
 * charts, never inside them. Areas whose name says it all are left out.
 */
export const AREA_DESCRIPTIONS: Record<string, string> = {
  'sec:EHS':
    'Mostly MassHealth (Medicaid health coverage), plus services for people with developmental disabilities, child welfare, mental health, cash assistance and public health.',
  'sec:EDU':
    'Mostly Chapter 70 aid to local school districts, plus child care, special education, UMass, state universities and community colleges.',
  'sec:STW':
    'Payments made for the whole state rather than one agency: mainly the yearly pension contribution, transfers to the MBTA, MassDOT and regional transit, and retiree health funding.',
  'sec:ANF':
    'Health insurance for state employees and retirees, unrestricted local aid to cities and towns, the Department of Revenue, snow and ice removal and state buildings.',
  'sec:TRE':
    'Mostly interest and principal on state borrowing, plus the State Lottery and the Mass Cultural Council.',
  'sec:HLC':
    'Emergency family shelter, rental vouchers and assistance, public housing subsidies, homeless shelters and housing production.',
  'sec:EPS':
    'State prisons, the State Police, the National Guard, fire services and other public safety agencies.',
  'sec:JUD':
    'The courts, probation, and lawyers for people who cannot afford one (Public Counsel Services).',
  'sec:SHF': 'County jails and houses of correction, run by the 14 sheriffs.',
  'sec:EEA':
    'Despite the name, little is energy: mostly state parks and conservation land, environmental protection, farms and emergency food aid, fish and wildlife, and utility regulation.',
  'sec:DOT':
    'Operating support for the MBTA and local transportation. Most transportation money is capital (roads, bridges, transit) or flows through transfers counted under Statewide obligations.',
  'sec:EED':
    'Business and community development grants, plus the agencies that regulate banks, insurance and licensed professions.',
  'sec:TSS': 'State government computer systems and cybersecurity, mostly charged back to other agencies.',
  'sec:VET': "Veterans' benefits and the state veterans' homes in Chelsea and Holyoke.",
  'sec:DAS': "The state's 11 district attorneys' offices, which prosecute crimes.",
  'sec:LWD': 'Job training, youth summer jobs, workplace safety and workers’ compensation oversight.',
  'sec:LEG': 'The House of Representatives, the Senate and their shared costs.',
  'sec:BLC': 'Aid to public libraries and regional library services.',
  'sec:HCF': 'Collects and publishes data on health care costs and quality.',
};

export function areaDescription(id: string): string | null {
  return AREA_DESCRIPTIONS[id] ?? null;
}
