"""Build the Specimen Hunter PAR sheet (Excel) from docs/par/specimen-hunter-par.json.

Usage (repo root):  python math/par_xlsx.py        (needs openpyxl; run math/par_sheet.mjs first)
Line-win probabilities, trigger chances, free-spin length, fish values and RTP are live formulas
built from the strip symbol counts, so the workbook recalculates if a strip count is changed.
Blue = input taken from the game files or simulation, black = formula, green = link to another sheet.
"""
import json
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as col

ROOT = Path(__file__).resolve().parent.parent
D = json.loads((ROOT / 'docs/par/specimen-hunter-par.json').read_text())
OUT = ROOT / 'docs/par/specimen-hunter-par.xlsx'

FONT = 'Arial'
BLUE, BLACK, GREEN = '0000FF', '000000', '008000'
f_in = Font(name=FONT, size=10, color=BLUE)
f_calc = Font(name=FONT, size=10, color=BLACK)
f_link = Font(name=FONT, size=10, color=GREEN)
f_head = Font(name=FONT, size=10, bold=True, color='FFFFFF')
f_title = Font(name=FONT, size=14, bold=True)
f_bold = Font(name=FONT, size=10, bold=True)
f_note = Font(name=FONT, size=9, italic=True, color='555555')
fill_head = PatternFill('solid', fgColor='1F4E5A')
fill_key = PatternFill('solid', fgColor='FFF2CC')
thin = Border(bottom=Side(style='thin', color='BBBBBB'))
PCT, PROB, MULT, INT = '0.000%', '0.0000000', '#,##0.00"x"', '#,##0'

SYMS = ['FLOAT', 'BOILIE', 'CORN', 'PELLET', 'FLASK', 'CATAPULT', 'NET', 'BIVVY', 'ROACH', 'BREAM', 'TENCH', 'MIRROR', 'WILD', 'ALARM', 'CASH']
NAMES = {'FLOAT': 'Float', 'BOILIE': 'Boilies', 'CORN': 'Sweetcorn', 'PELLET': 'Pellets', 'FLASK': 'Flask', 'CATAPULT': 'Catapult',
         'NET': 'Landing Net', 'BIVVY': 'Bivvy', 'ROACH': 'Roach', 'BREAM': 'Bream', 'TENCH': 'Tench', 'MIRROR': 'Mirror Carp',
         'WILD': 'Leather Carp (Wild)', 'ALARM': 'Bite Alarm (Scatter)', 'CASH': 'Specimen Fish (Cash)'}
TIER = {s: 'Low' for s in ['FLOAT', 'BOILIE', 'CORN', 'PELLET']} | {s: 'Mid' for s in ['FLASK', 'CATAPULT', 'NET', 'BIVVY']} | \
       {s: 'High' for s in ['ROACH', 'BREAM', 'TENCH', 'MIRROR']}
PAYING = list(D['paytable'].keys())

wb = Workbook()


def header(ws, row, labels, c0=1):
    for i, t in enumerate(labels):
        c = ws.cell(row=row, column=c0 + i, value=t)
        c.font, c.fill, c.alignment = f_head, fill_head, Alignment(horizontal='center', vertical='center', wrap_text=True)


def put(ws, r, c, v, font=f_calc, fmt=None, bold=False):
    cell = ws.cell(row=r, column=c, value=v)
    cell.font = Font(name=FONT, size=10, color=font.color, bold=bold) if bold else font
    if fmt:
        cell.number_format = fmt
    return cell


def note(ws, r, text, c=1):
    ws.cell(row=r, column=c, value=text).font = f_note


def widths(ws, ws_widths):
    for i, w in enumerate(ws_widths, 1):
        ws.column_dimensions[col(i)].width = w


# ------------------------------------------------------------------ Paytable
pt = wb.active
pt.title = 'Paytable'
pt['A1'] = 'Paytable (line pays)'; pt['A1'].font = f_title
note(pt, 2, 'Units are per line as stored in engine.js; x stake = units / 10 (10 lines, stake = total bet). Wild substitutes for all line symbols.')
header(pt, 4, ['Symbol', 'Code', 'Tier', '3 (units)', '4 (units)', '5 (units)', '3 (x stake)', '4 (x stake)', '5 (x stake)'])
PT_ROW = {}
for i, s in enumerate(PAYING):
    r = 5 + i; PT_ROW[s] = r
    put(pt, r, 1, NAMES[s]); put(pt, r, 2, s); put(pt, r, 3, TIER[s])
    for k in range(3):
        put(pt, r, 4 + k, D['paytable'][s][k], f_in)
        put(pt, r, 7 + k, f'={col(4 + k)}{r}/10', f_calc, '0.00"x"')
note(pt, 5 + len(PAYING) + 1, 'Source: client/src/engine.js PAY table. Five wilds on a line pay as Mirror Carp x5.')
widths(pt, [22, 11, 8, 10, 10, 10, 11, 11, 11])

# ------------------------------------------------------------------ Strips (counts and probabilities)
st = wb.create_sheet('Reel Strips')
st['A1'] = 'Reel strip symbol counts and stop probabilities'; st['A1'].font = f_title
note(st, 2, 'Counts from client/strips.json (each reel stops uniformly on one of its 32 positions). Probability = count / strip length.')
PROB_CELL = {}   # (set, reel, sym) -> absolute cell ref of the probability


def strip_block(set_key, title, r0):
    put(st, r0, 1, title, f_calc, bold=True)
    header(st, r0 + 1, ['Symbol', 'Reel 1', 'Reel 2', 'Reel 3', 'Reel 4', 'Reel 5', '', 'P reel 1', 'P reel 2', 'P reel 3', 'P reel 4', 'P reel 5'])
    for i, s in enumerate(SYMS):
        r = r0 + 2 + i
        put(st, r, 1, NAMES[s])
        for reel in range(5):
            put(st, r, 2 + reel, D['stripCounts'][set_key][reel][s], f_in, INT)
    tot = r0 + 2 + len(SYMS)
    put(st, tot, 1, 'Strip length', bold=True)
    for reel in range(5):
        c = col(2 + reel)
        put(st, tot, 2 + reel, f'=SUM({c}{r0 + 2}:{c}{tot - 1})', f_calc, INT)
    for i, s in enumerate(SYMS):
        r = r0 + 2 + i
        for reel in range(5):
            c = col(2 + reel)
            put(st, r, 8 + reel, f'={c}{r}/{c}${tot}', f_calc, '0.0000')
            PROB_CELL[(set_key, reel, s)] = f"'Reel Strips'!${col(8 + reel)}${r}"
    return tot + 2


nxt = strip_block('base', 'Base game strips', 4)
strip_block('free_spins', 'Free spins strips', nxt)
widths(st, [22, 9, 9, 9, 9, 9, 3, 10, 10, 10, 10, 10])

# ------------------------------------------------------------------ Line win probabilities (formulas)


def line_formula(set_key, S, k):
    """P(one payline pays S x k): sum over j = position of the first non-wild symbol (= S)."""
    P = lambda reel, sym: PROB_CELL[(set_key, reel, sym)]
    terms = []
    for j in range(k):
        f = [P(i, 'WILD') for i in range(j)] + [P(j, S)] + [f'({P(i, S)}+{P(i, "WILD")})' for i in range(j + 1, k)]
        if k < 5:
            f.append(f'(1-{P(k, S)}-{P(k, "WILD")})')
        terms.append('*'.join(f))
    if S == 'MIRROR' and k == 5:
        terms.append('*'.join(P(i, 'WILD') for i in range(5)))
    return '=' + '+'.join(terms)


def line_sheet(set_key, title):
    ws = wb.create_sheet(title)
    ws['A1'] = f'{title}: exact probability per payline'; ws['A1'].font = f_title
    note(ws, 2, 'Formula: the first non-wild symbol on the line is the target; wilds before/after it count; the next symbol must break the run.'
                ' Probabilities come from Reel Strips; RTP contribution = probability x pay (x stake) x 10 lines.')
    header(ws, 4, ['Symbol', 'Count', 'P (per line)', 'Pay (x stake)', 'RTP contribution', 'Check: engine exact'])
    r = 5
    for S in PAYING:
        for k in (3, 4, 5):
            put(ws, r, 1, NAMES[S]); put(ws, r, 2, k, f_calc, INT)
            put(ws, r, 3, line_formula(set_key, S, k), f_calc, PROB)
            put(ws, r, 4, f"=Paytable!{col(4 + k)}{PT_ROW[S]}", f_link, '0.00"x"')
            put(ws, r, 5, f'=C{r}*D{r}*10', f_calc, PCT)
            put(ws, r, 6, D['lineProbabilities'][set_key][S][k - 3], f_in, PROB)
            r += 1
    put(ws, r, 1, 'Total line RTP', bold=True)
    put(ws, r, 5, f'=SUM(E5:E{r - 1})', f_calc, PCT, bold=True)
    put(ws, r + 1, 1, 'Max difference vs engine exact (should be ~0)')
    put(ws, r + 1, 3, f'=SUMPRODUCT(ABS(C5:C{r - 1}-F5:F{r - 1}))', f_calc, '0.0E+00')
    note(ws, r + 3, 'Column F: same probability computed independently by math/par_sheet.mjs from the engine rules (cross-check).')
    widths(ws, [22, 8, 14, 13, 16, 18])
    return r


base_total_row = line_sheet('base', 'Line Wins Base')
fs_total_row = line_sheet('free_spins', 'Line Wins Free Spins')

# ------------------------------------------------------------------ Fish values
fv = wb.create_sheet('Fish Values')
fv['A1'] = 'Specimen Fish (cash) values in free spins'; fv['A1'].font = f_title
note(fv, 2, 'Each Specimen Fish that lands is weighed: one weight is drawn with the probabilities below and paid at once.')
header(fv, 4, ['Weight', 'Prize (x stake)', 'Draw weight', 'Probability', 'Contribution to mean', '1 in'])
n = len(D['fish'])
for i, (w, mult, weight) in enumerate(D['fish']):
    r = 5 + i
    put(fv, r, 1, w); put(fv, r, 2, mult, f_in, '#,##0.0"x"'); put(fv, r, 3, weight, f_in, '0.00')
    put(fv, r, 4, f'=C{r}/SUM($C$5:$C${4 + n})', f_calc, '0.0000%')
    put(fv, r, 5, f'=B{r}*D{r}', f_calc, '0.0000"x"')
    put(fv, r, 6, f'=1/D{r}', f_calc, INT)
FISH_MEAN = f"'Fish Values'!$E${6 + n}"
put(fv, 6 + n, 1, 'Mean fish value', bold=True); put(fv, 6 + n, 5, f'=SUM(E5:E{4 + n})', f_calc, '0.0000"x"', bold=True)
note(fv, 8 + n, 'Source: FISH table in client/src/engine.js. Record fish: 52lb 0oz (250x) and 64lb 8oz (1,000x).')
widths(fv, [14, 15, 13, 13, 20, 12])

# ------------------------------------------------------------------ Feature
fe = wb.create_sheet('Free Spins Feature')
fe['A1'] = 'Three Rods free spins'; fe['A1'].font = f_title
note(fe, 2, 'Trigger: a Bite Alarm visible on each of reels 2, 3 and 4 (any row). 10 free spins; 3 alarms in free spins add 5 more.')
header(fe, 4, ['Item', 'Value', 'Notes'])
rows = [
    ('P(alarm visible) reel 2, base', D['alarmVisible']['base'][1], f_in, PROB, 'Share of stops whose 3-row window contains an alarm (from strips.json)'),
    ('P(alarm visible) reel 3, base', D['alarmVisible']['base'][2], f_in, PROB, ''),
    ('P(alarm visible) reel 4, base', D['alarmVisible']['base'][3], f_in, PROB, ''),
    ('P(trigger) per base spin', '=B5*B6*B7', f_calc, PROB, 'Reels stop independently'),
    ('Trigger: 1 in', '=1/B8', f_calc, '#,##0.0', ''),
    ('P(alarm visible) reel 2, free spins', D['alarmVisible']['free_spins'][1], f_in, PROB, ''),
    ('P(alarm visible) reel 3, free spins', D['alarmVisible']['free_spins'][2], f_in, PROB, ''),
    ('P(alarm visible) reel 4, free spins', D['alarmVisible']['free_spins'][3], f_in, PROB, ''),
    ('P(retrigger) per free spin', '=B10*B11*B12', f_calc, PROB, ''),
    ('Expected free spins per feature', '=10/(1-5*B13)', f_calc, '0.000', 'Each spin adds 5 x P(retrigger) spins on average: 10 / (1 - 5q)'),
    ('Expected Specimen Fish per free spin', "=3*SUM('Reel Strips'!H{0}:L{0})".format(4 + 2 + len(SYMS) + 2 + 1 + 1 + SYMS.index('CASH')), f_calc, '0.0000', '3 visible rows x P(cash) summed over reels'),
    ('Mean fish value', '=' + FISH_MEAN, f_link, '0.0000"x"', 'From Fish Values'),
    ('Free-spin line RTP per spin', f"='Line Wins Free Spins'!E{fs_total_row}", f_link, '0.0000"x"', 'From Line Wins Free Spins'),
    ('Expected win per free spin', '=B17+B15*B16', f_calc, '0.0000"x"', 'Line wins + fish collected'),
    ('Expected feature win (uncapped)', '=B14*B18', f_calc, '0.00"x"', 'Ignores the 5,000x cap (never reached in simulation)'),
    ('Feature RTP contribution', '=B8*B19', f_calc, PCT, 'P(trigger) x expected feature win'),
]
for i, (lab, val, font, fmt, nt) in enumerate(rows):
    r = 5 + i
    put(fe, r, 1, lab); put(fe, r, 2, val, font, fmt); note(fe, r, nt, 3)
widths(fe, [38, 16, 80])

# ------------------------------------------------------------------ Win distribution (simulation)
S = D['simulation']
wd = wb.create_sheet('Win Distribution')
wd['A1'] = f"Win distribution (simulation of the production engine, {S['rounds']:,} rounds, seed {S['seed']})"; wd['A1'].font = f_title
note(wd, 2, 'Total win per game round (base spin + any free spins) as a multiple of stake. Rounds counted by math/par_sheet.mjs.')
put(wd, 3, 1, 'Rounds simulated'); put(wd, 3, 2, S['rounds'], f_in, INT)
header(wd, 5, ['Win band', 'Rounds', 'Probability', '1 in', 'RTP contribution'])
for i, b in enumerate(S['distribution']):
    r = 6 + i
    put(wd, r, 1, b['label']); put(wd, r, 2, b['rounds'], f_in, INT)
    put(wd, r, 3, f'=B{r}/$B$3', f_calc, '0.000000%')
    put(wd, r, 4, f'=IF(B{r}=0,"-",$B$3/B{r})', f_calc, '#,##0')
    put(wd, r, 5, b['rtpContribution'], f_in, PCT)
end = 5 + len(S['distribution'])
put(wd, end + 1, 1, 'Total', bold=True)
put(wd, end + 1, 2, f'=SUM(B6:B{end})', f_calc, INT, bold=True)
put(wd, end + 1, 3, f'=SUM(C6:C{end})', f_calc, '0.000%', bold=True)
put(wd, end + 1, 5, f'=SUM(E6:E{end})', f_calc, PCT, bold=True)
note(wd, end + 3, 'RTP contribution per band is the simulated sum of wins in that band divided by rounds (input from the simulation).')
widths(wd, [26, 14, 14, 14, 16])

# ------------------------------------------------------------------ Strip listing
sl = wb.create_sheet('Strip Listing')
sl['A1'] = 'Full reel strips (stop order)'; sl['A1'].font = f_title
header(sl, 3, ['Stop', 'Base R1', 'Base R2', 'Base R3', 'Base R4', 'Base R5', '', 'FS R1', 'FS R2', 'FS R3', 'FS R4', 'FS R5'])
for p in range(len(D['strips']['base'][0])):
    put(sl, 4 + p, 1, p, f_calc, INT)
    for reel in range(5):
        put(sl, 4 + p, 2 + reel, D['strips']['base'][reel][p], f_in)
        put(sl, 4 + p, 8 + reel, D['strips']['free_spins'][reel][p], f_in)
widths(sl, [6, 11, 11, 11, 11, 11, 3, 11, 11, 11, 11, 11])

# ------------------------------------------------------------------ Summary (first sheet)
sm = wb.create_sheet('Summary', 0)
sm['A1'] = 'Specimen Hunter - PAR sheet (probability accounting report)'; sm['A1'].font = f_title
note(sm, 2, f"{D['version']} | 5x3, 10 fixed lines | generated {D['generated'][:10]} | design figures, NOT independently certified")
header(sm, 4, ['Measure', 'Value', 'Source'])
summary = [
    ('Theoretical RTP (exact, uncapped)', f"='Line Wins Base'!E{base_total_row}+'Free Spins Feature'!B20", f_link, PCT, 'Exact from strips (formulas in this workbook)', True),
    ('  of which base game line wins', f"='Line Wins Base'!E{base_total_row}", f_link, PCT, 'Line Wins Base', False),
    ('  of which free spins feature', "='Free Spins Feature'!B20", f_link, PCT, 'Free Spins Feature', False),
    ('Simulated RTP', S['rtp'], f_in, PCT, f"Simulation, {S['rounds']:,} rounds", True),
    ('Simulated RTP 95% confidence (+/-)', S['ci95'], f_in, PCT, '1.96 x SD / sqrt(rounds)', False),
    ('Hit frequency (any line win in base spin)', S['hitFrequency'], f_in, PCT, 'Simulation', False),
    ('Feature frequency: 1 in', "='Free Spins Feature'!B9", f_link, '#,##0.0', 'Exact', False),
    ('Expected free spins per feature', "='Free Spins Feature'!B14", f_link, '0.00', 'Exact', False),
    ('Expected feature win (x stake)', "='Free Spins Feature'!B19", f_link, '0.00"x"', 'Exact (uncapped)', False),
    ('Volatility (standard deviation, x stake)', S['sd'], f_in, '0.00', 'Simulation', False),
    ('Returns below stake (0 < win < 1x)', S['belowStakeReturns'], f_in, PCT, 'Simulation; not celebrated (RTS 14F)', False),
    ('Highest win in simulation (x stake)', S['maxWin'], f_in, '#,##0.0"x"', 'Simulation', False),
    ('Maximum win cap per round (x stake)', D['maxWin'], f_in, '#,##0"x"', 'engine.js MAX_WIN', False),
    ('Rounds that hit the cap in simulation', S['cappedRounds'], f_in, INT, 'Simulation', False),
    ('Stake range (GB)', '£0.10 to £5.00 (£2.00 max for ages 18 to 24)', f_in, None, 'GB online slots stake limits 2025; operator may set lower', False),
]
for i, (lab, val, font, fmt, src, key) in enumerate(summary):
    r = 5 + i
    put(sm, r, 1, lab, bold=key); c = put(sm, r, 2, val, font, fmt, bold=key); note(sm, r, src, 3)
    if key:
        c.fill = fill_key
r = 6 + len(summary)
notes = [
    'Colour key: blue = input from game files or simulation; black = formula; green = link to another sheet.',
    'Exact figures assume the 5,000x cap is never reached; the simulation never reached it, so the effect is negligible.',
    'Simulation uses the production engine (client/src/engine.js) with a seeded PRNG for repeatability.',
    'Regenerate: node math/par_sheet.mjs 50000000 then python math/par_xlsx.py',
    'This is the developer\'s design PAR. Certification by a UKGC-approved test house is required before real-money use.',
]
for i, t in enumerate(notes):
    note(sm, r + 1 + i, t)
widths(sm, [44, 26, 60])

wb.save(OUT)
print(f'wrote {OUT}')
