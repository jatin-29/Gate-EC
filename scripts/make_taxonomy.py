#!/usr/bin/env python3
"""Writes data/<branch>/taxonomy.json.

Each subject lists its topics in syllabus order. A topic may carry `aliases`:
raw topic strings seen in imported data that should be folded into it. Matching
is case-insensitive. Edit this file, then re-run it, when the syllabus changes.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def T(name, *aliases):
    return {"name": name, "aliases": list(aliases)}


MISC = T("Miscellaneous", "", "Basic", "Miscellaneous Topics")

EC = [
    {"name": "Engineering Mathematics", "color": "#6366f1", "topics": [
        T("Linear Algebra"), T("Calculus"), T("Differential Equations"),
        T("Vector Calculus", "Vector Analysis"),
        T("Complex Analysis", "Complex Variables"),
        T("Probability & Statistics", "Probability and Statistics"),
        T("Numerical Methods", "Numerical Method"), MISC]},
    {"name": "Network Theory", "color": "#0ea5e9", "topics": [
        T("Basics of Network Analysis"), T("Network Theorems"),
        T("Transient Analysis"),
        T("Sinusoidal Steady State", "Sinusoidal Steady State Analysis"),
        T("Network Functions"), T("Two-Port Networks", "Two Port Networks"),
        T("Graph Theory & State Equations", "Graph Theory and State Equations"), MISC]},
    {"name": "Signals and Systems", "color": "#14b8a6", "topics": [
        T("Basics of Signals & Systems", "Basics of Signals and Systems"),
        T("LTI Systems", "LTI Systems Continuous and Discrete"),
        T("Fourier Series"),
        T("Fourier Transform, Frequency Response & Correlation", "Fourier Transforms, Frequency Response and Correlation"),
        T("Laplace Transform"), T("Sampling"), T("Z-Transform"),
        T("DTFS, DTFT & DFT", "DTFS, DTFT and DFT"), T("Digital Filters"), MISC]},
    {"name": "Electronic Devices", "color": "#f59e0b", "topics": [
        T("Basic Semiconductor Physics"),
        T("PN-Junction & Special Diodes", "PN-Junction Diodes and Special Diodes", "PN-Junction Diodes and Special"),
        T("BJT & FET Basics", "BJT and FET Basics"),
        T("IC Fabrication"), MISC]},
    {"name": "Analog Circuits", "color": "#ef4444", "topics": [
        T("Diode Applications", "Diodes Applications"), T("BJT Analysis"),
        T("FET & MOSFET Analysis", "FET and MOSFET Analysis"),
        T("Frequency Response of Amplifiers", "Frequency Response of Amplifier"),
        T("Feedback Amplifiers"), T("Operational Amplifiers"),
        T("Oscillator Circuits"),
        T("Multivibrators & 555 Timer", "Multivibrators and 555 Timer"), MISC]},
    {"name": "Digital Circuits", "color": "#8b5cf6", "topics": [
        T("Number Systems"), T("Boolean Algebra"), T("Logic Gates"),
        T("Combinational Circuits"), T("Sequential Circuits"),
        T("Finite State Machines", "Finite State Machine and Miscellaneous"),
        T("Logic Families"), T("Memories"), T("ADC & DAC", "ADC and DAC"), MISC]},
    {"name": "Microprocessors (8085)", "aliases": ["Microprocessors"], "color": "#64748b", "topics": [
        T("Basics of 8085", "Basics of 8085 Microprocessor"),
        T("Instruction Set", "Instructions of 8085 Microprocessor"),
        T("Programming", "Microprocessor 8085 Programming"),
        T("Interrupts", "Microprocessor 8085 Interrupts"),
        T("Interfacing & Peripherals", "Interfacing and Peripheral Devices"), MISC]},
    {"name": "Control Systems", "color": "#22c55e", "topics": [
        T("Block Diagram, SFG & Basics", "Basics of Control Systems, Block Diagram and SFGs"),
        T("Time Response Analysis"), T("Stability Analysis"), T("Root Locus"),
        T("Frequency Response Analysis"),
        T("Compensators & Controllers", "Compensators and Controllers"),
        T("State Space Analysis"), MISC]},
    {"name": "Communication Systems", "color": "#ec4899", "topics": [
        T("Analog Communications", "Analog Communication Systems"),
        T("Random Processes"),
        T("Random Signals & Noise", "Random Signals and Noise"),
        T("Digital Communications", "Digital Communication Systems"),
        T("Information Theory & Coding", "Information Theory and Coding"), MISC]},
    {"name": "Electromagnetics", "color": "#f97316", "topics": [
        T("Basics of Electromagnetics"),
        T("Plane Waves", "Plane waves and Properties", "Uniform Plane Waves"),
        T("Transmission Lines"), T("Waveguides"), T("Antennas"), MISC]},
    {"name": "General Aptitude", "color": "#84cc16", "topics": [
        T("Verbal Ability"), T("Numerical Ability")]},
]

EE = [
    {"name": "Engineering Mathematics", "color": "#6366f1", "topics": [
        T("Linear Algebra"), T("Calculus"), T("Differential Equations"),
        T("Complex Analysis", "Complex Variables"),
        T("Probability & Statistics", "Probability and Statistics"),
        T("Numerical Methods", "Numerical Method"), MISC]},
    {"name": "Electric Circuits", "color": "#0ea5e9", "topics": [
        T("Basics of Electric Circuits", "Basics of Electric Circuit"),
        T("Network Theorems"),
        T("Transients & Steady State Response", "Transients and Steady State Response"),
        T("Steady State AC Analysis"),
        T("Resonance & Locus Diagrams", "Resonance and Locus Diagrams"),
        T("Magnetically Coupled Circuits, Topology & Filters", "Magnetically Coupled Circuits, Network Topology and Filters"),
        T("Two-Port Networks & Network Functions", "Two Port Network and Network Functions"),
        T("Three-Phase Circuits"), MISC]},
    {"name": "Electromagnetic Fields", "aliases": ["Electromagnetic Theory"], "color": "#f97316", "topics": [
        T("Coordinate Systems & Vector Calculus", "Coordinate Systems and Vector Calculus"),
        T("Electrostatic Fields"), T("Magnetostatic Fields"),
        T("Time Varying Fields"), MISC]},
    {"name": "Signals and Systems", "color": "#14b8a6", "topics": [
        T("Introduction to CT & DT Signals", "Introduction of C.T. and D.T. Signals"),
        T("Linear Time Invariant Systems"), T("Fourier Series"),
        T("Fourier Transform"), T("Laplace Transform"), T("Sampling"),
        T("Z-Transform"), MISC]},
    {"name": "Electrical Machines", "color": "#a855f7", "topics": [
        T("Transformers"), T("DC Machines"),
        T("Three-Phase Induction Machines", "Three Phase Induction Machines"),
        T("Synchronous Machines"),
        T("Single-Phase Induction & Special Machines", "Single Phase Induction Motors, Special Purpose Machines and Electromechanical Energy Conversion System"),
        MISC]},
    {"name": "Power Systems", "color": "#eab308", "topics": [
        T("Generating Power Stations"),
        T("Transmission Lines: Parameters, Performance & Corona", "Performance of Transmission Lines, Line Parameters and Corona"),
        T("Distribution, Cables & Insulators", "Distribution Systems, Cables and Insulators"),
        T("Per Unit System"), T("Load Flow Studies"), T("Fault Analysis"),
        T("Power System Stability"),
        T("Economic Generation & Load Dispatch", "Economic Power Generation and Load Dispatch"),
        T("Compensation & Voltage Control", "Compensation Techniques and Voltage Profile Control"),
        T("Switchgear & Protection", "Switch Gear and Protection"),
        T("Power System Transients"), T("HVDC Transmission", "High Voltage DC Transmission"), MISC]},
    {"name": "Control Systems", "color": "#22c55e", "topics": [
        T("Mathematical Models of Physical Systems"),
        T("Feedback Characteristics", "Feedback Characteristics of Control Systems"), T("Time Response Analysis"),
        T("Concepts of Stability"), T("Root Locus Techniques"),
        T("Frequency Response Analysis"),
        T("Design of Control Systems"), T("State Variable Analysis"), MISC]},
    {"name": "Electrical & Electronic Measurements", "aliases": ["Electrical and Electronic Measurements"], "color": "#06b6d4", "topics": [
        T("Characteristics of Instruments & Systems", "Characteristics of Instruments and Measurement Systems"),
        T("Galvanometers, Voltmeters & Ammeters", "Galvanometers, Voltmeters and Ammeters"),
        T("Measurement of Energy & Power", "Measurement of Energy and Power"),
        T("Resistance Measurement & Potentiometers", "Measurement of Resistance and Potentiometers"),
        T("A.C. Bridges"), T("Instrument Transformers"),
        T("CRO & Electronic Measurements", "CRO and Electronic Measurements"), MISC]},
    {"name": "Analog Electronics", "color": "#ef4444", "topics": [
        T("Diodes & Applications", "Diodes and their Applications"),
        T("BJT, FET & Biasing", "BJT, FET and their Biasing Circuits"),
        T("Small Signal Analysis"), T("Operational Amplifiers"),
        T("Oscillators & Feedback Amplifiers", "Oscillators and Feedback Amplifiers"), MISC]},
    {"name": "Digital Electronics", "color": "#8b5cf6", "topics": [
        T("Boolean Algebra & Minimization", "Boolean Algebra and Minimization"),
        T("Logic Gates"), T("Combinational Logic Circuits"),
        T("Sequential Logic Circuits", "Sequential Circuits"),
        T("Logic Families", "Logic Families and Miscellaneous"),
        T("ADC & DAC", "A-D and D-A Converters"), T("Microprocessors"), MISC]},
    {"name": "Power Electronics", "color": "#f43f5e", "topics": [
        T("Power Semiconductor Devices & Commutation", "Power Semiconductor Devices and Commutation Techniques"),
        T("Phase Controlled Rectifiers"), T("Choppers"), T("Inverters"),
        T("Electrical Drives"), MISC]},
    {"name": "General Aptitude", "color": "#84cc16", "topics": [
        T("Verbal Ability"), T("Numerical Ability")]},
]

BRANCHES = {
    "ec": ("Electronics & Communication Engineering", EC),
    "ee": ("Electrical Engineering", EE),
}

if __name__ == "__main__":
    for key, (title, subjects) in BRANCHES.items():
        for s in subjects:
            s["id"] = slug(s["name"])
            s.setdefault("aliases", [])
            for t in s["topics"]:
                t["id"] = slug(t["name"])
        out = ROOT / "data" / key
        out.mkdir(parents=True, exist_ok=True)
        (out / "taxonomy.json").write_text(
            json.dumps({"branch": key, "title": title, "subjects": subjects}, indent=1, ensure_ascii=False) + "\n")
        print(key, len(subjects), "subjects", sum(len(s["topics"]) for s in subjects), "topics")
