import calendar
import html
import math
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple
from google import genai

import gspread
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from google.oauth2.service_account import Credentials


# =========================================================
# CONFIG
# =========================================================
SPREADSHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1vH9YgB2s1bMZlJ1-oJUkJcmd1AiQCn_OuWIzlb-u32I/edit?gid=0#gid=0"
)

LOCAL_CREDS_FILE = (
    Path(__file__).resolve().parent
    / "simosa-sentiment-automation-6225cae51719.json"
)

APP_KEY = "simosa"
APP_NAME = "SIMOSA"

# Brand palette inspired by the SIMOSA orange / magenta / violet identity.
ORANGE = "#FF8A1E"
ORANGE_DEEP = "#FF5D35"
PINK = "#E83882"
PURPLE = "#7B3FF2"
PURPLE_DEEP = "#4B2AA8"
INK = "#24212B"
MUTED = "#6D6876"
SOFT = "#F7F5FA"
BORDER = "#ECE8F1"
GREEN = "#2E9C78"
RED = "#D6535D"
AMBER = "#C78822"

SENTIMENT_COLORS = {
    "Positive": GREEN,
    "Neutral": "#B8B2C0",
    "Negative": RED,
}

RISK_BUCKETS = {
    "Bundles & Offers": "Offer Discovery",
    "Subscription & Auto-Renew": "Subscription Trust",
    "Rewards, Points & Gamification": "Engagement & Rewards",
    "Network & Internet (Coverage/Speed)": "Network Experience",
    "App Performance (Speed & Responsiveness)": "Performance",
    "App Stability & Errors (Crashes/Not Working)": "Reliability",
    "UI/UX & Navigation": "Usability",
    "Recharge & Balance": "Recharge & Balance",
    "Payments & Billing (Wallet/Transactions)": "Payments & Trust",
    "Overall Experience": "Generic Sentiment",
}

OWNER_MAP = {
    "Bundles & Offers": "Commercial / Product",
    "Subscription & Auto-Renew": "Growth / CRM / Product",
    "Rewards, Points & Gamification": "Loyalty / Product",
    "Network & Internet (Coverage/Speed)": "Network / CX",
    "App Performance (Speed & Responsiveness)": "App Engineering",
    "App Stability & Errors (Crashes/Not Working)": "App Engineering / QA",
    "UI/UX & Navigation": "Product Design / UX",
    "Recharge & Balance": "Payments / BSS / CX",
    "Payments & Billing (Wallet/Transactions)": "Payments / Billing / CX",
}

IMPACT_MAP = {
    "Bundles & Offers": "Package discovery and conversion friction",
    "Subscription & Auto-Renew": "Trust, unintended activation, and churn risk",
    "Rewards, Points & Gamification": "Engagement and perceived-value risk",
    "Network & Internet (Coverage/Speed)": "Core telecom experience dissatisfaction",
    "App Performance (Speed & Responsiveness)": "Task completion and repeat-use friction",
    "App Stability & Errors (Crashes/Not Working)": "Severe reliability and abandonment risk",
    "UI/UX & Navigation": "Discoverability and usability friction",
    "Recharge & Balance": "Core self-service and balance-confidence risk",
    "Payments & Billing (Wallet/Transactions)": "Financial trust and transaction-completion risk",
}

ACTION_MAP = {
    "Bundles & Offers": "Audit package discovery, eligibility messaging, pricing clarity, and activation steps.",
    "Subscription & Auto-Renew": "Make subscription state, auto-renew terms, and deactivation controls unmistakably clear.",
    "Rewards, Points & Gamification": "Review reward redemption, point visibility, and game mechanics for broken or low-value journeys.",
    "Network & Internet (Coverage/Speed)": "Segment complaints by location/device where possible and route recurring signals to network CX teams.",
    "App Performance (Speed & Responsiveness)": "Profile slow screens and API bottlenecks; prioritize high-frequency journeys first.",
    "App Stability & Errors (Crashes/Not Working)": "Correlate crash/error feedback with releases and prioritize reproducible failure loops.",
    "UI/UX & Navigation": "Run usability checks on navigation, search, package discovery, and complaint/feedback flows.",
    "Recharge & Balance": "Audit recharge confirmation, balance updates, deductions, and transaction-status communication.",
    "Payments & Billing (Wallet/Transactions)": "Investigate failed/duplicate deductions and improve transaction status, reversal, and refund messaging.",
}


# =========================================================
# PAGE SETUP
# =========================================================
st.set_page_config(
    page_title="SIMOSA Consumer Intelligence Dashboard",
    page_icon="🟠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =========================================================
# LOGIN / AUTHENTICATION
# =========================================================

def render_login_page():
    st.markdown(
        """
<style>
/* Hide sidebar + default chrome on login */
[data-testid="stSidebar"] {
    display: none !important;
}

[data-testid="stHeader"] {
    background: transparent !important;
}

#MainMenu {
    visibility: hidden;
}

footer {
    visibility: hidden;
}

/* Page background */
.stApp {
    background:
        radial-gradient(circle at 15% 15%, rgba(255,138,30,0.10), transparent 28%),
        radial-gradient(circle at 85% 10%, rgba(123,63,242,0.10), transparent 30%),
        radial-gradient(circle at 80% 85%, rgba(232,56,130,0.07), transparent 30%),
        #F8F7FB !important;
}

/* Center card */
.main .block-container {
    max-width: 100% !important;
    min-height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    padding-top: 4vh !important;
    padding-bottom: 4vh !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
}

/* Top info card */
.login-top-card {
    width: 100%;
    max-width: 330px;
    margin: 0 auto;
    background: #FFFFFF;
    border: 1px solid #ECE7F1;
    border-bottom: none;
    border-radius: 18px 18px 0 0;
    padding: 26px 24px 16px 24px;
    box-shadow: 0 22px 60px rgba(66, 43, 94, 0.08);
    position: relative;
    overflow: hidden;
}

.login-top-card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #FF8A1E, #F45A69, #E83882, #7B3FF2);
}

.login-top-card::after {
    content: "";
    position: absolute;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    right: -40px;
    top: -40px;
    background: linear-gradient(
        135deg,
        rgba(255,138,30,0.12),
        rgba(232,56,130,0.08),
        rgba(123,63,242,0.10)
    );
}

div[data-testid="stForm"] {
    width: 100% !important;
    max-width: 330px !important;
    margin: 0 auto !important;
    background: #FFFFFF !important;
    border: 1px solid #ECE7F1 !important;
    border-top: none !important;
    border-radius: 0 0 18px 18px !important;
    padding: 18px 24px 24px 24px !important;
    box-shadow: 0 22px 60px rgba(66, 43, 94, 0.08) !important;
}

/* Branding */
.login-pill {
    display: inline-block;
    position: relative;
    z-index: 2;
    padding: 7px 12px;
    border-radius: 999px;
    background: linear-gradient(
        90deg,
        rgba(255,138,30,0.10),
        rgba(232,56,130,0.10),
        rgba(123,63,242,0.10)
    );
    border: 1px solid rgba(123,63,242,0.10);
    color: #74437A;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 18px;
}

.login-caption {
    color: #97919F;
    font-size: 0.78rem;
    margin-bottom: 6px;
    text-align: center;
}

.login-title {
    color: #23212A;
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin-bottom: 10px;
    text-align: center;
}

.login-subtitle {
    color: #7A7482;
    font-size: 0.84rem;
    line-height: 1.5;
    margin-bottom: 2px;
    text-align: center;
}

/* Form card */
div[data-testid="stForm"] {
    background: #FFFFFF !important;
    border: 1px solid #ECE7F1 !important;
    border-top: none !important;
    border-radius: 0 0 22px 22px !important;
    padding: 22px 30px 28px 30px !important;
    box-shadow: 0 22px 60px rgba(66, 43, 94, 0.08) !important;
}

/* Labels */
div[data-testid="stForm"] [data-testid="stWidgetLabel"] p {
    color: #45414C !important;
    -webkit-text-fill-color: #45414C !important;
    font-size: 0.82rem !important;
    font-weight: 750 !important;
}

/* Inputs */
div[data-testid="stForm"] [data-baseweb="input"] {
    background: #FAFAFC !important;
    border: 1px solid #DEDAE5 !important;
    border-radius: 12px !important;
    overflow: hidden !important;
}

div[data-testid="stForm"] input {
    background: #FAFAFC !important;
    color: #23212A !important;
    -webkit-text-fill-color: #23212A !important;
    min-height: 48px !important;
    font-size: 0.92rem !important;
}

div[data-testid="stForm"] input::placeholder {
    color: #AAA4B0 !important;
    -webkit-text-fill-color: #AAA4B0 !important;
}

div[data-testid="stForm"] [data-baseweb="input"]:focus-within {
    border: 1px solid #BC66D2 !important;
    box-shadow: 0 0 0 3px rgba(123,63,242,0.08) !important;
}

/* Password eye */
div[data-testid="stForm"] [data-baseweb="input"] button {
    background: #FAFAFC !important;
    border: none !important;
    color: #6D6875 !important;
}

div[data-testid="stForm"] [data-baseweb="input"] button svg {
    fill: #6D6875 !important;
    color: #6D6875 !important;
}

/* Login button */
div[data-testid="stForm"] [data-testid="stFormSubmitButton"] button {
    width: 100% !important;
    min-height: 50px !important;
    margin-top: 10px !important;
    border: none !important;
    border-radius: 12px !important;
    background: linear-gradient(
        100deg,
        #FF8A1E 0%,
        #F3576D 40%,
        #E83882 68%,
        #7B3FF2 100%
    ) !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    font-weight: 800 !important;
    font-size: 0.95rem !important;
    box-shadow: 0 10px 24px rgba(214, 76, 136, 0.18) !important;
}

div[data-testid="stForm"] [data-testid="stFormSubmitButton"] button:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(214, 76, 136, 0.24) !important;
}

/* Error */
div[data-testid="stAlert"] {
    border-radius: 12px !important;
    margin-top: 12px !important;
}

/* Footer */
.login-footer {
    text-align: center;
    color: #A19AA8;
    font-size: 0.74rem;
    margin-top: 18px;
}
</style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
<div class="login-top-card">
    <div class="login-pill">SIMOSA · Consumer Intelligence</div>
    <div class="login-caption">Please enter your details</div>
    <div class="login-title">Welcome back</div>
    <div class="login-subtitle">
        Sign in to access SIMOSA consumer intelligence,
        sentiment trends and actionable product insights.
    </div>
</div>
        """,
        unsafe_allow_html=True,
    )

    with st.form("simosa_login_form"):
        username = st.text_input(
            "Username",
            placeholder="Enter your username",
        )

        password = st.text_input(
            "Password",
            type="password",
            placeholder="Enter your password",
        )

        submitted = st.form_submit_button(
            "Login",
            use_container_width=True,
        )

        if submitted:
            if username == "simosa" and password == "simosa123":
                st.session_state["authenticated"] = True
                st.rerun()
            else:
                st.error("Incorrect username or password.")

    st.markdown(
        """
<div class="login-footer">
    SIMOSA Consumer Intelligence · Authorized Access Only
</div>
        """,
        unsafe_allow_html=True,
    )

# Initialize authentication state
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    render_login_page()
    st.stop()

def inject_css() -> None:
    st.markdown(
        f"""
        <style>
        [data-testid="stSidebarNav"] {{ display: none; }}

        :root {{
            --orange: {ORANGE};
            --orange-deep: {ORANGE_DEEP};
            --pink: {PINK};
            --purple: {PURPLE};
            --purple-deep: {PURPLE_DEEP};
            --ink: {INK};
            --muted: {MUTED};
            --soft: {SOFT};
            --border: {BORDER};
        }}

        .stApp {{
            background:
                radial-gradient(circle at 8% 2%, rgba(255,138,30,0.10), transparent 25%),
                radial-gradient(circle at 98% 6%, rgba(123,63,242,0.09), transparent 28%),
                #FFFFFF;
            color: var(--ink);
        }}

        .main .block-container {{
            padding-top: 1.25rem;
            padding-bottom: 3rem;
            max-width: 1480px;
        }}

                /* Sidebar */
        [data-testid="stSidebar"] {{
            background: #34343D !important;
            border-right: 1px solid #454550 !important;
        }}

        [data-testid="stSidebar"] h1,
        [data-testid="stSidebar"] h2,
        [data-testid="stSidebar"] h3 {{
            color: #171515 !important;
            -webkit-text-fill-color: #171515 !important;
        }}

        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] label {{
            color: #34343D !important;
            -webkit-text-fill-color: #34343D!important;
        }}

        [data-testid="stSidebar"] [data-testid="stCaptionContainer"] p {{
            color: #34343D !important;
            -webkit-text-fill-color: #34343D !important;
        }}

        [data-testid="stSidebar"] [data-baseweb="select"] > div {{
            background: #FFFFFF !important;
            border: 1px solid #34343D !important;
            border-radius: 11px !important;
        }}

        [data-testid="stSidebar"] [data-baseweb="select"] * {{
            color: #34343D !important;
            -webkit-text-fill-color: #34343D !important;
        }}

        [data-testid="stSidebar"] .simosa-pill {{
            background: #FFFFFF !important;
            color: #363737 !important;
            -webkit-text-fill-color: #363737 !important;
        }}

        [data-testid="stSidebar"] hr {{
            border-color: rgba(255,255,255,0.16) !important;
        }}

        /* Hero */
        .simosa-hero-wrap {{
            position: relative;
            border-radius: 28px;
            padding: 1px;
            background: linear-gradient(120deg, #FF8A1E, #FF5D35, #E83882, #7B3FF2);
            box-shadow: 0 18px 50px rgba(71, 43, 112, 0.11);
            margin-bottom: 14px;
            overflow: hidden;
        }}

        .simosa-hero {{
            position: relative;
            background: rgba(255,255,255,0.96);
            border-radius: 27px;
            padding: 30px 32px;
            overflow: hidden;
        }}

        .simosa-hero::after {{
            content: "";
            position: absolute;
            width: 310px;
            height: 310px;
            border-radius: 50%;
            right: -80px;
            top: -135px;
            background: linear-gradient(135deg, rgba(255,138,30,0.22), rgba(232,56,130,0.14), rgba(123,63,242,0.18));
            filter: blur(2px);
        }}

        .brand-mark {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px;
            border-radius: 999px;
            background: linear-gradient(100deg, rgba(255,138,30,0.10), rgba(232,56,130,0.10), rgba(123,63,242,0.10));
            border: 1px solid rgba(123,63,242,0.12);
            font-size: 0.76rem;
            font-weight: 850;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #5A3976;
            margin-bottom: 12px;
        }}

        .hero-title {{
            font-size: 2.35rem;
            font-weight: 900;
            line-height: 1.05;
            letter-spacing: -0.035em;
            margin: 0 0 10px 0;
            color: var(--ink);
        }}

        .gradient-text {{
            background: linear-gradient(90deg, #FF7A1A, #E83882 52%, #713CE7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}

        .hero-subtitle {{
            max-width: 980px;
            color: var(--muted);
            font-size: 1.02rem;
            line-height: 1.55;
            margin: 0;
        }}

        /* Pills */
        .pill-row {{ margin: 10px 0 16px 0; }}
        .simosa-pill {{
            display: inline-block;
            padding: 7px 12px;
            border-radius: 999px;
            margin: 0 7px 7px 0;
            font-size: 0.78rem;
            font-weight: 760;
            color: #4E4058;
            background: #FFFFFF;
            border: 1px solid #E9E4EE;
            box-shadow: 0 5px 14px rgba(57, 38, 74, 0.05);
        }}

        /* Section headings */
        .section-kicker {{
            color: #A34B7A;
            font-size: 0.74rem;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            font-weight: 850;
            margin-bottom: 3px;
        }}
        .section-title {{
            font-size: 1.33rem;
            font-weight: 900;
            color: var(--ink);
            margin-bottom: 5px;
            letter-spacing: -0.015em;
        }}
        .section-subtitle {{
            color: var(--muted);
            font-size: 0.92rem;
            margin-bottom: 14px;
        }}
        .section-title::after {{
            content: "";
            display: block;
            width: 170px;
            height: 3px;
            margin-top: 8px;
            border-radius: 99px;
            background: linear-gradient(90deg, #FF8A1E, #E83882, #7B3FF2);
        }}

        /* Cards */
        .metric-card, .insight-card {{
            position: relative;
            background: rgba(255,255,255,0.95);
            border: 1px solid #EEE9F2;
            border-radius: 22px;
            box-shadow: 0 10px 30px rgba(53, 36, 69, 0.06);
            overflow: hidden;
        }}
        .metric-card {{
            min-height: 166px;
            padding: 18px 18px 16px 18px;
        }}
        .metric-card::before {{
            content: "";
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, #FF8A1E, #E83882, #7B3FF2);
            opacity: .95;
        }}
        .metric-label {{
            color: var(--muted);
            font-size: 0.82rem;
            font-weight: 760;
            margin-bottom: 13px;
        }}
        .metric-value {{
            font-size: 2.25rem;
            font-weight: 920;
            color: var(--ink);
            line-height: 1.02;
            margin-bottom: 10px;
            letter-spacing: -0.03em;
        }}
        .metric-value-small {{
            font-size: 1.25rem;
            font-weight: 880;
            color: var(--ink);
            line-height: 1.2;
            margin: 2px 0 10px 0;
        }}
        .delta-up {{ color: #218868; font-weight: 800; font-size: .82rem; }}
        .delta-down {{ color: #C94752; font-weight: 800; font-size: .82rem; }}
        .delta-flat {{ color: #80798A; font-weight: 760; font-size: .82rem; }}

        .insight-card {{
            min-height: 160px;
            padding: 19px 20px;
        }}
        .insight-title {{
            font-size: 0.74rem;
            text-transform: uppercase;
            letter-spacing: .08em;
            font-weight: 850;
            color: #9B4A7A;
            margin-bottom: 8px;
        }}
        .insight-body {{
            font-size: .97rem;
            line-height: 1.48;
            font-weight: 690;
            color: var(--ink);
        }}
        .insight-note {{
            font-size: .81rem;
            color: var(--muted);
            margin-top: 7px;
        }}

        /* Containers / tabs */
        div[data-testid="stVerticalBlockBorderWrapper"] {{
            border: 1px solid #EEE9F2;
            border-radius: 24px;
            background: rgba(255,255,255,0.84);
            box-shadow: 0 8px 28px rgba(60, 40, 80, 0.045);
            padding: 4px;
        }}

        .stTabs [data-baseweb="tab-list"] {{
            gap: 7px;
            padding: 6px;
            background: #F7F4F9;
            border-radius: 15px;
        }}
        .stTabs [data-baseweb="tab"] {{
            border-radius: 11px;
            padding: 9px 16px;
            font-weight: 760;
            color: #ba6300 !important;
        }}
        .stTabs [aria-selected="true"] {{
            background: linear-gradient(100deg, #FF8A1E, #E83882, #7B3FF2) !important;
            color: #FFFFFF !important;
            box-shadow: 0 7px 18px rgba(165, 57, 138, 0.20);
        }}
        .stTabs [aria-selected="true"] p {{ color: #FFFFFF !important; }}

        /* Inputs */
        div[data-baseweb="select"] > div {{
            background: #FFFFFF;
            border-color: #E6E0EB;
            border-radius: 11px;
        }}
        .main [data-testid="stWidgetLabel"] p,
        .main [data-baseweb="select"] * {{
            color: #3e3e45 !important;
            -webkit-text-fill-color: #3e3e45 !important;
        }}

        /* Review Explorer multiselect text */
        [data-testid="stMultiSelect"] label,
        [data-testid="stMultiSelect"] p,
        [data-testid="stMultiSelect"] span,
        [data-testid="stMultiSelect"] div {{
            color: #5F5F68 !important;
            -webkit-text-fill-color: #5F5F68 !important;
        }}

        .stButton > button {{
            border-radius: 11px;
            font-weight: 780;
            border: 0;
            color: #FFFFFF;
            background: linear-gradient(100deg, #FF8A1E, #E83882, #7B3FF2);
        }}

        .trend-chip {{
            background: rgba(255,255,255,0.95);
            border: 1px solid #EEE9F2;
            border-top: 3px solid #7B3FF2;
            border-radius: 16px;
            padding: 13px 16px;
            box-shadow: 0 8px 22px rgba(53, 36, 69, 0.05);
        }}
        .trend-chip-label {{
            color: var(--muted);
            font-size: 0.78rem;
            font-weight: 750;
            margin-bottom: 6px;
        }}
        .trend-chip-value {{
            font-size: 1.55rem;
            font-weight: 900;
            letter-spacing: -0.02em;
            line-height: 1.05;
            margin-bottom: 6px;
        }}

        /* Review Explorer — Gemini aspect summary */
        .aspect-summary-card {{
            position: relative;
            background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(252,249,255,0.98));
            border: 1px solid #EAE4EF;
            border-radius: 20px;
            padding: 24px 26px 25px 26px;
            margin: 18px 0 20px 0;
            box-shadow: 0 10px 30px rgba(62, 42, 78, 0.055);
            overflow: hidden;
        }}

        .aspect-summary-card::before {{
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, #FF8A1E, #E83882, #7B3FF2);
        }}

        .aspect-summary-kicker {{
            color: #A34B7A;
            font-size: 0.70rem;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            font-weight: 850;
            margin-bottom: 8px;
        }}

        .aspect-summary-title {{
            color: #24212B;
            font-size: 1.28rem;
            font-weight: 900;
            letter-spacing: -0.015em;
            margin-bottom: 4px;
        }}

        .aspect-summary-meta {{
            color: #918A98;
            font-size: 0.78rem;
            margin-bottom: 16px;
        }}

        .aspect-summary-body {{
            color: #4D4853;
            font-size: 0.95rem;
            line-height: 1.68;
            font-weight: 500;
        }}

        .mini-caption {{
            color: #817987;
            font-size: .78rem;
        }}
        .spacer {{ height: 24px; }}
        hr {{ border-color: #EEE9F2; }}
        </style>
        """,
        unsafe_allow_html=True,
    )


inject_css()


# =========================================================
# DATA ACCESS
# =========================================================
def get_gspread_client():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    if LOCAL_CREDS_FILE.exists():
        credentials = Credentials.from_service_account_file(
            str(LOCAL_CREDS_FILE),
            scopes=scopes,
        )
    else:
        service_account_info = None

        # Preferred secret for this app.
        try:
            service_account_info = dict(st.secrets["simosa_gcp_service_account"])
        except Exception:
            pass

        # Optional fallback if you use one shared service-account key.
        if service_account_info is None:
            try:
                service_account_info = dict(st.secrets["gcp_service_account"])
            except Exception as error:
                raise RuntimeError(
                    "SIMOSA Google credentials were not found. For local use, place "
                    "'simosa-sentiment-automation-6225cae51719.json' beside SimosaDashboard.py. "
                    "For Streamlit Cloud, add the service-account JSON under "
                    "[simosa_gcp_service_account] in Secrets."
                ) from error

        credentials = Credentials.from_service_account_info(
            service_account_info,
            scopes=scopes,
        )

    return gspread.authorize(credentials)


@st.cache_resource(show_spinner=False)
def get_spreadsheet():
    return get_gspread_client().open_by_url(SPREADSHEET_URL)


@st.cache_data(ttl=300, show_spinner=False)
def list_worksheets():
    return [worksheet.title for worksheet in get_spreadsheet().worksheets()]


@st.cache_data(ttl=300, show_spinner=False)
def read_worksheet(worksheet_name: str) -> pd.DataFrame:
    worksheet = get_spreadsheet().worksheet(worksheet_name)
    return pd.DataFrame(worksheet.get_all_records())


@st.cache_data(ttl=300, show_spinner=False)
def get_latest_month() -> str:
    meta = read_worksheet("meta")
    if meta.empty:
        raise ValueError("The SIMOSA meta worksheet is empty.")

    row = meta.loc[meta["key"].astype(str) == "latest_month", "value"]
    if row.empty:
        raise ValueError("latest_month was not found in the SIMOSA meta worksheet.")

    return str(row.iloc[0]).strip()


@st.cache_data(ttl=300, show_spinner=False)
def available_month_keys() -> list[str]:
    months = {
        title.replace("summary_", "", 1)
        for title in list_worksheets()
        if title.startswith("summary_")
    }
    return sorted(months, reverse=True)


# =========================================================
# HELPERS
# =========================================================
def parse_month_label(month_key: str) -> str:
    year, month = month_key.split("_")
    return datetime(int(year), int(month), 1).strftime("%B %Y")


def previous_month_key(month_key: str, all_months: list[str]) -> Optional[str]:
    try:
        index = all_months.index(month_key)
    except ValueError:
        return None
    return all_months[index + 1] if index + 1 < len(all_months) else None


def to_numeric_safe(df: pd.DataFrame, columns) -> pd.DataFrame:
    output = df.copy()
    for column in columns:
        if column in output.columns:
            output[column] = pd.to_numeric(output[column], errors="coerce")
    return output


def get_app_metric(df: pd.DataFrame, metric: str) -> Optional[float]:
    if df.empty or metric not in df.columns:
        return None
    value = df.iloc[0].get(metric)
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_num(value, default=0.0) -> float:
    try:
        if value is None or pd.isna(value):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def hex_to_rgba(hex_color: str, alpha: float) -> str:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{alpha})"


def build_delta(
    current: Optional[float],
    previous: Optional[float],
    suffix: str = "",
) -> Tuple[str, str]:
    if current is None or previous is None or pd.isna(current) or pd.isna(previous):
        return "No comparison", "flat"

    delta = current - previous
    if abs(delta) < 1e-9:
        return f"0.00{suffix}", "flat"

    sign = "+" if delta > 0 else ""
    return f"{sign}{delta:.2f}{suffix}", "up" if delta > 0 else "down"


def metric_card(
    label: str,
    value: str,
    delta: str = "",
    direction: str = "flat",
    small_value: bool = False,
) -> None:
    value_class = "metric-value-small" if small_value else "metric-value"
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">{label}</div>
            <div class="{value_class}">{value}</div>
            <div class="delta-{direction}">{delta}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def insight_card(title: str, body: str, note: str = "") -> None:
    st.markdown(
        f"""
        <div class="insight-card">
            <div class="insight-title">{title}</div>
            <div class="insight-body">{body}</div>
            <div class="insight-note">{note}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_header(title: str, subtitle: str = "", kicker: str = "") -> None:
    if kicker:
        st.markdown(f'<div class="section-kicker">{kicker}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="section-title">{title}</div>', unsafe_allow_html=True)
    if subtitle:
        st.markdown(f'<div class="section-subtitle">{subtitle}</div>', unsafe_allow_html=True)


def style_figure(fig: go.Figure, height: int = 380) -> go.Figure:
    fig.update_layout(
        height=height,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=INK, family="Inter, Segoe UI, Arial"),
        margin=dict(l=20, r=20, t=42, b=35),
        hoverlabel=dict(
            bgcolor="#332B3C",
            bordercolor="#5C4A68",
            font=dict(color="#FFFFFF", size=12),
        ),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0,
        ),
    )
    fig.update_xaxes(
        showgrid=False,
        zeroline=False,
        linecolor="rgba(80,70,90,.12)",
        tickfont=dict(color=MUTED),
        title_font=dict(color=MUTED),
    )
    fig.update_yaxes(
        gridcolor="rgba(95,75,110,.10)",
        zeroline=False,
        tickfont=dict(color=MUTED),
        title_font=dict(color=MUTED),
    )
    return fig


def render_plotly(fig: go.Figure, key: str, height: int = 380) -> None:
    st.plotly_chart(
        style_figure(fig, height),
        use_container_width=True,
        key=key,
        config={"displayModeBar": False},
    )


def load_month_bundle(month_key: str) -> Dict[str, pd.DataFrame]:
    required = {
        "summary": f"summary_{month_key}",
        "weekly": f"weekly_{month_key}",
        "daily": f"daily_ratings_{month_key}",
        "aspects": f"simosa_aspects_{month_key}",
        "tagged": f"simosa_tagged_reviews_{month_key}",
        "insights": f"simosa_insights_{month_key}",
    }

    optional = {
        "untagged": f"simosa_untagged_{month_key}",
        "raw": f"simosa_raw_reviews_{month_key}",
        "sentiment": f"sentiment_{month_key}",
    }

    bundle = {key: read_worksheet(sheet) for key, sheet in required.items()}

    existing_titles = set(list_worksheets())
    for key, sheet in optional.items():
        bundle[key] = read_worksheet(sheet) if sheet in existing_titles else pd.DataFrame()

    return bundle


def preprocess_bundle(bundle: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    out = {key: value.copy() for key, value in bundle.items()}

    out["summary"] = to_numeric_safe(
        out["summary"],
        [
            "total_reviews",
            "avg_rating",
            "positive_pct",
            "negative_pct",
            "neutral_pct",
            "five_star",
            "four_star",
            "three_star",
            "two_star",
            "one_star",
        ],
    )

    out["weekly"] = to_numeric_safe(
        out["weekly"],
        ["reviews", "avg_rating", "avg_sentiment"],
    )

    out["daily"] = to_numeric_safe(out["daily"], ["avg_rating", "n_reviews"])
    if "date" in out["daily"].columns:
        out["daily"]["date"] = pd.to_datetime(out["daily"]["date"], errors="coerce")

    out["aspects"] = to_numeric_safe(
        out["aspects"],
        ["mentions", "Positive", "Neutral", "Negative", "Unknown", "pos_%", "neu_%", "neg_%"],
    )
    if "Aspect" in out["aspects"].columns:
        out["aspects"]["risk_bucket"] = (
            out["aspects"]["Aspect"].map(RISK_BUCKETS).fillna("Other")
        )

    out["tagged"] = to_numeric_safe(out["tagged"], ["rating"])
    if "date" in out["tagged"].columns:
        out["tagged"]["date"] = pd.to_datetime(out["tagged"]["date"], errors="coerce")

    out["insights"] = to_numeric_safe(
        out["insights"],
        [
            "monthly_avg_rating",
            "total_reviews",
            "positive_reviews",
            "neutral_reviews",
            "negative_reviews",
            "aspect_coverage_pct",
        ],
    )

    if not out["raw"].empty:
        out["raw"] = to_numeric_safe(out["raw"], ["rating"])
        if "date" in out["raw"].columns:
            out["raw"]["date"] = pd.to_datetime(out["raw"]["date"], errors="coerce")

    return out


def actionable_aspects(aspects_df: pd.DataFrame) -> pd.DataFrame:
    if aspects_df.empty or "Aspect" not in aspects_df.columns:
        return aspects_df.copy()
    return aspects_df[
        aspects_df["Aspect"].astype(str).str.strip().str.lower() != "overall experience"
    ].copy()


def build_priority_matrix(aspects_df: pd.DataFrame) -> pd.DataFrame:
    if aspects_df.empty:
        return aspects_df.copy()

    df = aspects_df.copy()
    df["negative_rate"] = np.where(
        df["mentions"] > 0,
        df["Negative"] / df["mentions"] * 100,
        0,
    )

    max_mentions = max(safe_num(df["mentions"].max(), 0), 1)
    df["volume_index"] = df["mentions"] / max_mentions * 100
    df["priority_score"] = 0.58 * df["volume_index"] + 0.42 * df["negative_rate"]

    q70 = df["priority_score"].quantile(0.70) if len(df) > 1 else df["priority_score"].max()
    q40 = df["priority_score"].quantile(0.40) if len(df) > 1 else df["priority_score"].max()

    df["priority"] = np.select(
        [df["priority_score"] >= q70, df["priority_score"] >= q40],
        ["P1", "P2"],
        default="P3",
    )
    return df.sort_values(["priority_score", "Negative"], ascending=False)


def build_action_board(priority_df: pd.DataFrame) -> pd.DataFrame:
    if priority_df.empty:
        return pd.DataFrame()

    board = priority_df[
        ["Aspect", "mentions", "Negative", "negative_rate", "priority", "risk_bucket"]
    ].copy()
    board["owner"] = board["Aspect"].map(OWNER_MAP).fillna("Product / CX")
    board["business_impact"] = board["Aspect"].map(IMPACT_MAP).fillna("Customer experience risk")
    board["suggested_action"] = board["Aspect"].map(ACTION_MAP).fillna(
        "Review representative complaints and assign the recurring failure pattern to the relevant owner."
    )
    return board


def build_issue_movement(
    current_aspects: pd.DataFrame,
    comparison_aspects: pd.DataFrame,
) -> pd.DataFrame:
    if current_aspects.empty or comparison_aspects.empty:
        return pd.DataFrame()

    current = current_aspects[["Aspect", "mentions", "Negative", "neg_%"]].copy()
    comparison = comparison_aspects[["Aspect", "mentions", "Negative", "neg_%"]].copy()

    current.columns = ["Aspect", "current_mentions", "current_negative", "current_neg_rate"]
    comparison.columns = ["Aspect", "comparison_mentions", "comparison_negative", "comparison_neg_rate"]

    merged = current.merge(comparison, on="Aspect", how="outer").fillna(0)
    merged["negative_change"] = merged["current_negative"] - merged["comparison_negative"]
    merged["negative_rate_change_pp"] = merged["current_neg_rate"] - merged["comparison_neg_rate"]
    return merged.sort_values("negative_change", ascending=False)


def unique_tagged_review_count(tagged_df: pd.DataFrame) -> int:
    if tagged_df.empty:
        return 0

    dedupe_cols = [column for column in ["name", "review_text", "date"] if column in tagged_df.columns]
    if not dedupe_cols:
        return len(tagged_df)
    return len(tagged_df.drop_duplicates(subset=dedupe_cols))


def build_review_window_distribution(tagged_df: pd.DataFrame, month_key: str) -> pd.DataFrame:
    if tagged_df.empty or "date" not in tagged_df.columns:
        return pd.DataFrame(columns=["period", "reviews"])

    year_str, month_str = month_key.split("_")
    year = int(year_str)
    month = int(month_str)
    last_day = calendar.monthrange(year, month)[1]

    df = tagged_df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    dedupe_cols = [column for column in ["name", "review_text", "date"] if column in df.columns]
    if dedupe_cols:
        df = df.drop_duplicates(subset=dedupe_cols)

    windows = [(1, 5), (6, 10), (11, 15), (16, 20), (21, 25), (26, last_day)]
    rows = []
    for start_day, end_day in windows:
        count = df[
            (df["date"].dt.day >= start_day) & (df["date"].dt.day <= end_day)
        ].shape[0]
        rows.append({"period": f"{start_day}–{end_day}", "reviews": int(count)})

    return pd.DataFrame(rows)


# =========================================================
# GEMINI — TEXT GENERATION HELPERS
# =========================================================
GEMINI_MODELS = ("gemini-3.7-flash", "gemini-3.6-flash")


def get_gemini_api_key() -> str:
    """Read the Gemini key from Streamlit secrets."""
    try:
        api_key = str(st.secrets["GEMINI_API_KEY"]).strip()
    except Exception as error:
        raise RuntimeError(
            "Gemini API key was not found. Add GEMINI_API_KEY to "
            ".streamlit/secrets.toml and restart Streamlit."
        ) from error

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is empty in .streamlit/secrets.toml.")
    return api_key


def call_gemini_text(prompt: str) -> str:
    """Call Gemini's Interactions API and return plain text."""
    client = genai.Client(api_key=get_gemini_api_key())
    errors = []

    for model_name in GEMINI_MODELS:
        try:
            interaction = client.interactions.create(
                model=model_name,
                input=prompt,
                store=False,
            )
            output = (interaction.output_text or "").strip()
            if output:
                return output
            errors.append(f"{model_name}: empty response")
        except Exception as error:
            errors.append(f"{model_name}: {error}")

    raise RuntimeError("Gemini request failed. " + " | ".join(errors))


# =========================================================
# GEMINI — ASPECT REVIEW SUMMARY
# =========================================================
@st.cache_data(ttl=3600, show_spinner=False)
def generate_aspect_summary(
    aspect: str,
    month_key: str,
    reviews: tuple[str, ...],
) -> str:
    """Generate one paragraph for the selected aspect."""
    clean_reviews = [str(review).strip() for review in reviews if str(review).strip()]
    if not clean_reviews:
        return "No review text is available for this aspect."

    clean_reviews = list(dict.fromkeys(clean_reviews))
    review_sample = clean_reviews[:150]
    review_text = "\n".join(f"- {review}" for review in review_sample)

    prompt = f"""
You are a senior consumer intelligence and UX research analyst.

Analyze the following Google Play reviews for the SIMOSA application.

Reporting month: {parse_month_label(month_key)}
Selected aspect: {aspect}

Reviews:
{review_text}

Write ONE concise paragraph summarizing what users are experiencing specifically
regarding the selected aspect.

Requirements:
- Write approximately 90-130 words.
- Cluster repeated comments into a coherent description of the main specific issues.
- Prioritize the most common and concrete user friction patterns.
- Explain what users are actually struggling with rather than giving generic sentiment.
- Mention positive feedback only when it provides important context.
- Do not make recommendations.
- Do not use bullet points, numbered lists, headings, labels, or separate sections.
- Do not mention reviewer names.
- Do not say that you are an AI or describe your analysis process.
- Do not invent any issue that is not supported by the supplied reviews.
- Use simple, clear, management-ready English.
- Return only a single paragraph.
"""

    try:
        return call_gemini_text(prompt)
    except Exception as error:
        return f"Aspect summary could not be generated: {error}"


# =========================================================
# GEMINI — EXECUTIVE SUMMARY
# =========================================================
@st.cache_data(ttl=3600, show_spinner=False)
def generate_executive_summary(
    month_label: str,
    total_reviews_value: Optional[float],
    avg_rating_value: Optional[float],
    positive_pct_value: Optional[float],
    negative_pct_value: Optional[float],
    neutral_pct_value: Optional[float],
    prev_reviews_value: Optional[float],
    prev_rating_value: Optional[float],
    prev_positive_value: Optional[float],
    prev_negative_value: Optional[float],
    aspect_stats: tuple,
    review_records: tuple,
) -> str:
    """Create a leadership-ready monthly readout grounded in metrics and reviews."""

    def fmt_num(value, decimals=1):
        if value is None or pd.isna(value):
            return "N/A"
        return f"{float(value):.{decimals}f}"

    current_reviews_text = (
        f"{int(total_reviews_value):,}" if total_reviews_value is not None else "N/A"
    )
    previous_reviews_text = (
        f"{int(prev_reviews_value):,}" if prev_reviews_value is not None else "N/A"
    )

    aspect_lines = []
    for row in aspect_stats:
        aspect_lines.append(
            f"- {row[0]}: {int(row[1])} mentions, {int(row[2])} positive, "
            f"{int(row[3])} negative, {float(row[4]):.1f}% positive, "
            f"{float(row[5]):.1f}% negative"
        )
    aspect_text = "\n".join(aspect_lines) or "No aspect statistics available."

    review_lines = []
    for aspect, sentiment, rating, review in review_records:
        review_lines.append(
            f"- Aspect: {aspect} | Sentiment: {sentiment} | "
            f"Rating: {rating} | Review: {review}"
        )
    reviews_text = "\n".join(review_lines) or "No written review evidence available."

    prompt = f"""
You are a senior consumer intelligence and UX research analyst.

Create the monthly executive summary for SIMOSA Google Play customer feedback.
Use ONLY the metrics, aspect statistics, and customer reviews supplied below.

REPORTING MONTH
{month_label}

CURRENT MONTH METRICS
Total reviews: {current_reviews_text}
Average rating: {fmt_num(avg_rating_value, 2)}/5
Positive share: {fmt_num(positive_pct_value)}%
Negative share: {fmt_num(negative_pct_value)}%
Neutral share: {fmt_num(neutral_pct_value)}%

PREVIOUS MONTH METRICS
Total reviews: {previous_reviews_text}
Average rating: {fmt_num(prev_rating_value, 2)}/5
Positive share: {fmt_num(prev_positive_value)}%
Negative share: {fmt_num(prev_negative_value)}%

ASPECT STATISTICS
{aspect_text}

ACTUAL CUSTOMER REVIEW EVIDENCE
{reviews_text}

Write a management-ready executive summary using simple English.

Rules:
- Return 5 to 7 main bullet points in Markdown.
- The FIRST bullet must give the overall month overview: total reviews, average rating,
  positive share, negative share, neutral share, and month-over-month movement when
  previous-month data is available.
- Include both areas that performed well and areas that performed poorly.
- For strong areas, explain WHY users were positive using specific experiences found
  in the supplied reviews.
- For weak areas, explain the concrete problems users experienced using the supplied
  reviews.
- Use useful statistics such as mention counts, positive counts, negative counts,
  positive percentages, and negative percentages where they strengthen the point.
- Prioritize important findings; do not create one bullet for every aspect.
- When an aspect has several recurring issues, group them into one clear bullet.
- Bold important aspect names, issue names, numbers, percentages, and key findings
  using Markdown **bold**.
- You may include a very short direct customer quote only when it strongly explains
  an issue. The quote must be copied exactly from the supplied evidence.
- Never invent a quote, statistic, issue, or trend.
- Do not call something a trend unless comparison data supports it.
- Do not make recommendations. If customers explicitly ask for a feature, describe it
  as a customer need rather than as your recommendation.
- Do not add a heading because the dashboard already has one.
- Do not use tables or nested bullet lists.
- Keep each bullet concise but meaningful.
- Return only the Markdown bullets.
"""

    try:
        return call_gemini_text(prompt)
    except Exception as error:
        return f"Executive summary could not be generated: {error}"


@st.cache_data(ttl=300, show_spinner=False)
def build_trend_dataset(month_keys: list[str]) -> pd.DataFrame:
    """Lightweight month-over-month totals pulled straight from each summary_ sheet.

    Only reads total_reviews / positive_pct / negative_pct, so it stays cheap even
    though it loads several months at once for the trend chart.
    """
    rows = []
    for month_key in month_keys:
        try:
            summary = read_worksheet(f"summary_{month_key}")
        except Exception:
            continue
        if summary.empty:
            continue

        summary = to_numeric_safe(summary, ["total_reviews", "positive_pct", "negative_pct"])
        total = safe_num(summary.iloc[0].get("total_reviews"))
        positive_pct = safe_num(summary.iloc[0].get("positive_pct"))
        negative_pct = safe_num(summary.iloc[0].get("negative_pct"))

        rows.append(
            {
                "month_key": month_key,
                "month_label": parse_month_label(month_key),
                "total_reviews": total,
                "positive_reviews": round(total * positive_pct / 100),
                "negative_reviews": round(total * negative_pct / 100),
            }
        )

    return pd.DataFrame(rows)


# =========================================================
# CONNECT + LOAD MONTH LIST
# =========================================================
try:
    latest_month = get_latest_month()
    all_months = available_month_keys()
except Exception as error:
    st.error(f"Could not connect to the SIMOSA Google Sheet: {error}")
    st.stop()

if not all_months:
    st.error("No monthly summary worksheets were found in the SIMOSA Google Sheet.")
    st.stop()


# =========================================================
# SIDEBAR
# =========================================================
st.sidebar.markdown("## SIMOSA Intelligence")
st.sidebar.caption("Google Play review intelligence for product, CX, and design teams")

selected_month = st.sidebar.selectbox(
    "Reporting month",
    options=all_months,
    index=all_months.index(latest_month) if latest_month in all_months else 0,
    format_func=parse_month_label,
)

if "simosa_compare_previous" not in st.session_state:
    st.session_state.simosa_compare_previous = True
if "simosa_compare_custom" not in st.session_state:
    st.session_state.simosa_compare_custom = False


def use_previous_comparison():
    if st.session_state.simosa_compare_previous:
        st.session_state.simosa_compare_custom = False


def use_custom_comparison():
    if st.session_state.simosa_compare_custom:
        st.session_state.simosa_compare_previous = False


compare_previous = st.sidebar.toggle(
    "Compare with previous month",
    key="simosa_compare_previous",
    on_change=use_previous_comparison,
)

compare_custom = st.sidebar.toggle(
    "Compare with another month",
    key="simosa_compare_custom",
    on_change=use_custom_comparison,
)

comparison_month = None
if compare_custom:
    selected_index = all_months.index(selected_month)
    older_months = all_months[selected_index + 1 :]
    if older_months:
        comparison_month = st.sidebar.selectbox(
            "Comparison month",
            options=older_months,
            format_func=parse_month_label,
            key="simosa_custom_comparison_month",
        )
    else:
        st.sidebar.info("There are no earlier months available for comparison.")
elif compare_previous:
    comparison_month = previous_month_key(selected_month, all_months)

st.sidebar.markdown("---")
st.sidebar.markdown(
    f'<span class="simosa-pill">Latest: {parse_month_label(latest_month)}</span>',
    unsafe_allow_html=True,
)
if comparison_month:
    st.sidebar.caption(
        f"Comparing {parse_month_label(selected_month)} with {parse_month_label(comparison_month)}"
    )

if st.sidebar.button("Refresh dashboard data", use_container_width=True):
    st.cache_data.clear()
    st.cache_resource.clear()
    st.rerun()


# =========================================================
# LOAD SELECTED + COMPARISON DATA
# =========================================================
try:
    current_bundle = preprocess_bundle(load_month_bundle(selected_month))
except Exception as error:
    st.error(f"Could not load {parse_month_label(selected_month)} data: {error}")
    st.stop()

comparison_bundle = None
if comparison_month:
    try:
        comparison_bundle = preprocess_bundle(load_month_bundle(comparison_month))
    except Exception as error:
        st.warning(
            f"Could not load comparison data for {parse_month_label(comparison_month)}: {error}"
        )

summary_df = current_bundle["summary"].copy()
weekly_df = current_bundle["weekly"].copy()
daily_df = current_bundle["daily"].copy()
aspects_df = actionable_aspects(current_bundle["aspects"])
tagged_df = current_bundle["tagged"].copy()
insights_df = current_bundle["insights"].copy()
untagged_df = current_bundle["untagged"].copy()
raw_df = current_bundle["raw"].copy()

comparison_summary_df = (
    comparison_bundle["summary"].copy() if comparison_bundle else pd.DataFrame()
)
comparison_aspects_df = (
    actionable_aspects(comparison_bundle["aspects"]) if comparison_bundle else pd.DataFrame()
)

priority_df = build_priority_matrix(aspects_df)
action_board = build_action_board(priority_df)
issue_movement_df = build_issue_movement(aspects_df, comparison_aspects_df)

# 3-month trend window: the selected month plus its two most recent predecessors,
# in chronological (oldest -> newest) order.
selected_month_index = all_months.index(selected_month)
trend_month_keys = all_months[selected_month_index: selected_month_index + 3][::-1]
trend_df = build_trend_dataset(trend_month_keys)


# =========================================================
# CORE METRICS
# =========================================================
total_reviews = get_app_metric(summary_df, "total_reviews")
avg_rating = get_app_metric(summary_df, "avg_rating")
positive_pct = get_app_metric(summary_df, "positive_pct")
negative_pct = get_app_metric(summary_df, "negative_pct")
neutral_pct = get_app_metric(summary_df, "neutral_pct")

prev_reviews = get_app_metric(comparison_summary_df, "total_reviews")
prev_rating = get_app_metric(comparison_summary_df, "avg_rating")
prev_positive = get_app_metric(comparison_summary_df, "positive_pct")
prev_negative = get_app_metric(comparison_summary_df, "negative_pct")

coverage = (
    safe_num(insights_df.iloc[0].get("aspect_coverage_pct"), np.nan)
    if not insights_df.empty
    else np.nan
)

health_score = (
    safe_num(positive_pct) * 0.45
    + (safe_num(avg_rating) / 5 * 100) * 0.35
    + (100 - safe_num(negative_pct)) * 0.20
)
health_score = max(0, min(100, health_score))

highest_risk = priority_df.iloc[0]["Aspect"] if not priority_df.empty else None
most_discussed = (
    aspects_df.sort_values("mentions", ascending=False).iloc[0]["Aspect"]
    if not aspects_df.empty
    else None
)
best_strength = (
    aspects_df.sort_values(["Positive", "mentions"], ascending=False).iloc[0]["Aspect"]
    if not aspects_df.empty
    else None
)

most_deteriorated = None
if not issue_movement_df.empty:
    worsened = issue_movement_df.sort_values("negative_change", ascending=False)
    if not worsened.empty and safe_num(worsened.iloc[0]["negative_change"]) > 0:
        most_deteriorated = worsened.iloc[0]["Aspect"]

unique_tagged = unique_tagged_review_count(tagged_df)


# =========================================================
# HERO
# =========================================================
st.markdown(
    f"""
    <div class="simosa-hero-wrap">
        <div class="simosa-hero">
            <div class="brand-mark">SIMOSA · Consumer Intelligence</div>
            <div class="hero-title">Simosa <span class="gradient-text">Product Intelligence</span></div>
            <p class="hero-subtitle">
                A decision-focused view of SIMOSA's review health, product friction, recurring user themes,
                and month-level issue movement for <b>{parse_month_label(selected_month)}</b>.
            </p>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="pill-row">
        <span class="simosa-pill">Reporting month · {parse_month_label(selected_month)}</span>
        <span class="simosa-pill">Source · Google Play Pakistan</span>
        <span class="simosa-pill">App · SIMOSA / JazzWorld</span>
        <span class="simosa-pill">Actionable themes · {len(aspects_df):,}</span>
    </div>
    """,
    unsafe_allow_html=True,
)


overview_tab, intelligence_tab, reviews_tab = st.tabs(
    ["Executive Overview", "Product Intelligence", "Review Explorer"]
)


# =========================================================
# TAB 1 — EXECUTIVE OVERVIEW
# =========================================================
with overview_tab:
    section_header(
        "Executive command center",
        "The fastest read on review volume, sentiment health, coverage, and customer experience pressure.",
        "Monthly health",
    )

    k1, k2, k3, k4, k5, k6 = st.columns(6)

    with k1:
        d, s = build_delta(total_reviews, prev_reviews)
        metric_card("Google Play reviews", f"{int(total_reviews):,}" if total_reviews is not None else "—", d, s)

    with k2:
        d, s = build_delta(avg_rating, prev_rating)
        metric_card("Average rating", f"{avg_rating:.2f}/5" if avg_rating is not None else "—", d, s)

    with k3:
        d, s = build_delta(positive_pct, prev_positive, " pp")
        metric_card("Positive share", f"{positive_pct:.1f}%" if positive_pct is not None else "—", d, s)

    with k4:
        d, s = build_delta(negative_pct, prev_negative, " pp")
        metric_card("Negative share", f"{negative_pct:.1f}%" if negative_pct is not None else "—", d, s)

    with k5:
        metric_card("Aspect coverage", f"{coverage:.1f}%" if pd.notna(coverage) else "—", "Tagged review coverage", "flat")

    with k6:
        metric_card("Product health", f"{health_score:.0f}/100", "Composite experience index", "flat")

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # Executive signals
    e1, e2, e3 = st.columns(3)
    with e1:
        insight_card(
            "Primary risk",
            highest_risk or "No actionable risk detected",
            "Highest combined complaint volume and negative intensity.",
        )
    with e2:
        insight_card(
            "Strongest positive theme",
            best_strength or "No positive theme detected",
            "The actionable theme carrying the strongest positive signal.",
        )
    with e3:
        movement_text = most_deteriorated or (
            "No worsening theme detected" if comparison_month else "Enable a comparison to track movement"
        )
        insight_card(
            "Fastest worsening signal",
            movement_text,
            "Based on change in negative aspect mentions versus the selected comparison month.",
        )

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    left, right = st.columns([1.55, 0.95])

    with left:
        with st.container(border=True):
            section_header(
                "Rating trajectory",
                "Average rating across alternate-day observations in the selected month.",
                "Experience quality",
            )

            if daily_df.empty or "date" not in daily_df.columns:
                st.info("No daily rating data available.")
            else:
                chart_df = daily_df.dropna(subset=["date", "avg_rating"]).sort_values("date")
                fig = go.Figure()
                fig.add_trace(
                    go.Scatter(
                        x=chart_df["date"],
                        y=chart_df["avg_rating"],
                        mode="lines+markers",
                        name="Average rating",
                        line=dict(width=4, color=PURPLE),
                        marker=dict(size=9, color=ORANGE, line=dict(width=2, color="#FFFFFF")),
                        fill="tozeroy",
                        fillcolor="rgba(123,63,242,0.05)",
                        hovertemplate="Date: %{x|%d %b}<br>Avg rating: %{y:.2f}<extra></extra>",
                    )
                )
                fig.update_yaxes(range=[1, 5], tickvals=[1, 2, 3, 4, 5])
                render_plotly(fig, "simosa_daily_rating", height=400)

    with right:
        with st.container(border=True):
            section_header(
                "Sentiment mix",
                "Share of positive, neutral, and negative ratings.",
                "Review sentiment",
            )

            sentiment_df = pd.DataFrame(
                {
                    "Sentiment": ["Positive", "Neutral", "Negative"],
                    "Share": [safe_num(positive_pct), safe_num(neutral_pct), safe_num(negative_pct)],
                }
            )
            fig = px.pie(
                sentiment_df,
                names="Sentiment",
                values="Share",
                hole=0.67,
                color="Sentiment",
                color_discrete_map=SENTIMENT_COLORS,
            )
            fig.update_traces(textinfo="percent", textfont=dict(size=13))
            fig.update_layout(
                annotations=[
                    dict(
                        text=f"<b>{avg_rating:.2f}</b><br><span style='font-size:11px'>avg rating</span>"
                        if avg_rating is not None
                        else "Rating",
                        x=0.5,
                        y=0.5,
                        showarrow=False,
                        font=dict(color=INK, size=19),
                    )
                ]
            )
            render_plotly(fig, "simosa_sentiment_mix", height=400)

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # Weekly pulse
    with st.container(border=True):
        section_header(
            "Weekly customer pulse",
            "Review volume and average sentiment score reveal when customer pressure intensified during the month.",
            "In-month movement",
        )

        if weekly_df.empty:
            st.info("No weekly sentiment data available.")
        else:
            fig = go.Figure()
            fig.add_trace(
                go.Bar(
                    x=weekly_df["week_label"],
                    y=weekly_df["reviews"],
                    name="Reviews",
                    marker=dict(
                        color=weekly_df["reviews"],
                        colorscale=[[0, "#FFD9B5"], [0.5, "#F99863"], [1, "#E83882"]],
                        line=dict(width=0),
                    ),
                    yaxis="y",
                    hovertemplate="Week %{x}<br>Reviews: %{y}<extra></extra>",
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=weekly_df["week_label"],
                    y=weekly_df["avg_sentiment"],
                    name="Avg sentiment",
                    mode="lines+markers",
                    line=dict(color=PURPLE, width=4),
                    marker=dict(color="#FFFFFF", size=9, line=dict(color=PURPLE, width=3)),
                    yaxis="y2",
                    hovertemplate="Week %{x}<br>Sentiment: %{y:.2f}<extra></extra>",
                )
            )
            fig.update_layout(
                yaxis=dict(title="Review volume"),
                yaxis2=dict(
                    title="Sentiment score",
                    overlaying="y",
                    side="right",
                    range=[-1, 1],
                    showgrid=False,
                ),
                bargap=0.42,
            )
            render_plotly(fig, "simosa_weekly_pulse", height=410)

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # Star distribution + review distribution
    c_left, c_right = st.columns(2)

    with c_left:
        with st.container(border=True):
            section_header("Star rating distribution", "Volume of 1★ through 5★ reviews.", "Rating composition")

            if summary_df.empty:
                st.info("No rating distribution available.")
            else:
                row = summary_df.iloc[0]
                stars = pd.DataFrame(
                    {
                        "Rating": ["5★", "4★", "3★", "2★", "1★"],
                        "Reviews": [
                            safe_num(row.get("five_star")),
                            safe_num(row.get("four_star")),
                            safe_num(row.get("three_star")),
                            safe_num(row.get("two_star")),
                            safe_num(row.get("one_star")),
                        ],
                    }
                )
                fig = px.bar(
                    stars,
                    x="Rating",
                    y="Reviews",
                    color="Reviews",
                    color_continuous_scale=["#EEE8F8", "#F3A466", "#E83882", "#6E3AD7"],
                    text_auto=".0f",
                )
                fig.update_layout(coloraxis_showscale=False)
                render_plotly(fig, "simosa_star_distribution", height=355)

    with c_right:
        with st.container(border=True):
            section_header("Review activity windows", "Unique tagged reviews across five-day windows.", "Activity pattern")
            windows = build_review_window_distribution(tagged_df, selected_month)
            if windows.empty:
                st.info("No review activity data available.")
            else:
                fig = px.bar(
                    windows,
                    x="period",
                    y="reviews",
                    text="reviews",
                    color="reviews",
                    color_continuous_scale=["#F7D8B4", "#F47A6C", "#8A43D9"],
                )
                fig.update_layout(coloraxis_showscale=False)
                render_plotly(fig, "simosa_review_windows", height=355)


# =========================================================
# TAB 2 — PRODUCT INTELLIGENCE
# =========================================================
with intelligence_tab:
    section_header(
        "Actionable product intelligence",
        "Focuses only on feature- and issue-specific feedback; generic 'Overall Experience' sentiment is excluded.",
        "Aspect intelligence",
    )

    a1, a2, a3, a4 = st.columns(4)
    with a1:
        metric_card("Actionable themes", f"{len(aspects_df):,}", "Distinct issue / feature clusters", "flat")
    with a2:
        metric_card("Unique tagged reviews", f"{unique_tagged:,}", "Reviews matched to at least one theme", "flat")
    with a3:
        metric_card("Most discussed", most_discussed or "—", "Highest actionable mention volume", "flat", True)
    with a4:
        metric_card("Highest risk", highest_risk or "—", "Priority score leader", "flat", True)

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # 3-month trend analysis
    with st.container(border=True):
        section_header(
            "3-month trend analysis",
            f"Total, positive, and negative Google Play reviews across the three most recent months ending "
            f"{parse_month_label(selected_month)}.",
            "Trend tracking",
        )

        if trend_df.empty or len(trend_df) < 2:
            st.info("Not enough monthly history is available yet to plot a 3-month trend.")
        else:
            trend_series = [
                ("Total reviews", "total_reviews", PURPLE),
                ("Positive reviews", "positive_reviews", GREEN),
                ("Negative reviews", "negative_reviews", RED),
            ]

            # Snapshot chips: latest value + month-over-month movement for each series,
            # styled like the rest of the dashboard's metric cards.
            chip_cols = st.columns(3)
            for (label, column, color), chip_col in zip(trend_series, chip_cols):
                latest_value = trend_df[column].iloc[-1]
                prior_value = trend_df[column].iloc[-2] if len(trend_df) > 1 else None
                d, s = build_delta(latest_value, prior_value)
                with chip_col:
                    st.markdown(
                        f"""
                        <div class="trend-chip" style="border-top-color:{color};">
                            <div class="trend-chip-label">{label}</div>
                            <div class="trend-chip-value" style="color:{color};">{latest_value:,.0f}</div>
                            <div class="delta-{s}">{d} vs prior month</div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

            st.markdown('<div style="height:14px"></div>', unsafe_allow_html=True)

            fig = go.Figure()

            fig.add_trace(
                go.Bar(
                    x=trend_df["month_label"],
                    y=trend_df["positive_reviews"],
                    name="Positive reviews",
                    marker=dict(
                        color=hex_to_rgba(GREEN, 0.82),
                        line=dict(color=GREEN, width=1.5),
                    ),
                    hovertemplate="<b>Positive reviews</b><br>%{x}<br>%{y:,.0f}<extra></extra>",
                )
            )
            fig.add_trace(
                go.Bar(
                    x=trend_df["month_label"],
                    y=trend_df["negative_reviews"],
                    name="Negative reviews",
                    marker=dict(
                        color=hex_to_rgba(RED, 0.82),
                        line=dict(color=RED, width=1.5),
                    ),
                    hovertemplate="<b>Negative reviews</b><br>%{x}<br>%{y:,.0f}<extra></extra>",
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=trend_df["month_label"],
                    y=trend_df["total_reviews"],
                    name="Total reviews",
                    mode="lines+markers+text",
                    line=dict(width=4.5, color=PURPLE, shape="spline", smoothing=0.35),
                    marker=dict(size=15, color="#FFFFFF", line=dict(width=3.5, color=PURPLE)),
                    text=[f"{v:,.0f}" for v in trend_df["total_reviews"]],
                    textposition="top center",
                    textfont=dict(color=PURPLE_DEEP, size=13, family="Inter, Segoe UI, Arial"),
                    hovertemplate="<b>Total reviews</b><br>%{x}<br>%{y:,.0f}<extra></extra>",
                )
            )

            # Apply the shared theme first, then layer our own margin/legend on top
            # so they aren't clobbered by style_figure()'s defaults.
            fig = style_figure(fig, height=440)
            fig.update_layout(
                barmode="group",
                bargap=0.38,
                bargroupgap=0.12,
                margin=dict(l=20, r=20, t=95, b=35),
                yaxis_title="Reviews",
                hovermode="x unified",
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.1,
                    xanchor="left",
                    x=0,
                    bgcolor="rgba(255,255,255,0.92)",
                    bordercolor="#EEE9F2",
                    borderwidth=1,
                    font=dict(color=INK, size=13, family="Inter, Segoe UI, Arial"),
                ),
            )
            fig.update_yaxes(rangemode="tozero")
            st.plotly_chart(
                fig,
                use_container_width=True,
                key="simosa_three_month_trend",
                config={"displayModeBar": False},
            )

            if len(trend_df) < 3:
                st.caption(
                    f"Only {len(trend_df)} month(s) of history are available in the sheet; "
                    "the chart will extend to a full 3-month view as more months are added."
                )

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    with st.container(border=True):
        section_header(
            "Customer Pain Index",
            "Actionable themes ranked by combined complaint volume and negative intensity.",
            "CX priority ranking",
        )
        if priority_df.empty:
            st.info("No actionable aspect data available.")
        else:
            pain_df = priority_df.copy()
            pain_df["priority_score"] = pd.to_numeric(
                pain_df["priority_score"], errors="coerce"
            ).fillna(0)
            pain_df["negative_rate"] = pd.to_numeric(
                pain_df["negative_rate"], errors="coerce"
            ).fillna(0)
            pain_df = pain_df.sort_values("priority_score", ascending=True)
            pain_df["score_label"] = pain_df["priority_score"].round(0).astype(int).astype(str)

            fig = px.bar(
                pain_df,
                x="priority_score",
                y="Aspect",
                orientation="h",
                color="priority_score",
                color_continuous_scale=["#FFD09C", "#F47A6C", "#C94F85", "#7B3FF2"],
                text="score_label",
                custom_data=["mentions", "Negative", "negative_rate", "priority"],
                labels={
                    "priority_score": "Pain index",
                    "Aspect": "",
                },
            )
            fig.update_traces(
                texttemplate="<b>%{text}</b>",
                textposition="outside",
                cliponaxis=False,
                marker=dict(line=dict(width=0)),
                hovertemplate=(
                    "<b>%{y}</b><br>"
                    "Pain index: %{x:.0f}/100<br>"
                    "Mentions: %{customdata[0]:.0f}<br>"
                    "Negative mentions: %{customdata[1]:.0f}<br>"
                    "Negative rate: %{customdata[2]:.1f}%<br>"
                    "Priority: %{customdata[3]}<extra></extra>"
                ),
            )
            fig.update_layout(
                coloraxis_showscale=False,
                bargap=0.34,
                margin=dict(l=20, r=45, t=42, b=35),
            )
            fig.update_xaxes(
                range=[0, 100],
                dtick=20,
                title="Customer Pain Index (0–100)",
            )
            fig.update_yaxes(
                categoryorder="array",
                categoryarray=pain_df["Aspect"].tolist(),
                title="",
            )
            render_plotly(fig, "simosa_customer_pain_index", height=430)

    # Positive vs negative theme profile
    with st.container(border=True):
        section_header(
            "Theme sentiment profile",
            "Positive and negative shares by actionable user-feedback theme.",
            "Perception profile",
        )
        if aspects_df.empty:
            st.info("No aspect sentiment data available.")
        else:
            profile = aspects_df.sort_values("mentions", ascending=True).copy()
            fig = go.Figure()
            fig.add_trace(
                go.Bar(
                    y=profile["Aspect"],
                    x=profile["pos_%"],
                    name="Positive",
                    orientation="h",
                    marker_color=GREEN,
                )
            )
            fig.add_trace(
                go.Bar(
                    y=profile["Aspect"],
                    x=profile["neg_%"],
                    name="Negative",
                    orientation="h",
                    marker_color=RED,
                )
            )
            fig.update_layout(
                barmode="group",
                xaxis_title="Share of mentions (%)",
                yaxis_title="",
                legend=dict(
                    font=dict(
                        color="#000000",
                        size=13
                    )
                )
            )
            render_plotly(fig, "simosa_theme_sentiment_profile", height=max(420, len(profile) * 44))

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # Comparison movement
    with st.container(border=True):
        comparison_title = (
            "Month-over-month issue movement"
            if compare_previous
            else "Issue movement between selected months"
        )
        comparison_subtitle = (
            f"Change in negative aspect mentions: {parse_month_label(selected_month)} vs "
            f"{parse_month_label(comparison_month)}. Positive values mean complaint pressure increased."
            if comparison_month
            else "Enable a comparison mode in the sidebar to track issue movement."
        )
        section_header(comparison_title, comparison_subtitle, "Change tracking")

        if issue_movement_df.empty:
            st.info("No comparison issue movement is available for the selected months.")
        else:
            movement = issue_movement_df.sort_values("negative_change", ascending=False).copy()
            max_abs = max(abs(movement["negative_change"]).max(), 1)
            movement["color_norm"] = movement["negative_change"]

            fig = px.bar(
                movement,
                x="Aspect",
                y="negative_change",
                color="color_norm",
                color_continuous_scale=[
                    [0.0, "#3A9D7D"],
                    [0.5, "#F2D6B0"],
                    [1.0, "#CF4767"],
                ],
                range_color=[-max_abs, max_abs],
                labels={"negative_change": "Change in negative mentions"},
            )
            fig.update_layout(coloraxis_showscale=False)
            fig.update_xaxes(tickangle=-28)
            render_plotly(fig, "simosa_issue_movement", height=430)

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # =========================================================
    # EXECUTIVE SUMMARY — METRICS + REVIEW EVIDENCE
    # =========================================================
    executive_aspect_stats = []
    if not aspects_df.empty:
        for _, row in aspects_df.iterrows():
            executive_aspect_stats.append(
                (
                    str(row.get("Aspect", "")),
                    safe_num(row.get("mentions")),
                    safe_num(row.get("Positive")),
                    safe_num(row.get("Negative")),
                    safe_num(row.get("pos_%")),
                    safe_num(row.get("neg_%")),
                )
            )

    executive_reviews_df = tagged_df.copy()
    if not executive_reviews_df.empty and "aspects" in executive_reviews_df.columns:
        executive_reviews_df = executive_reviews_df[
            executive_reviews_df["aspects"]
            .astype(str)
            .str.strip()
            .str.lower()
            != "overall experience"
        ]

        dedupe_columns = [
            column
            for column in ["aspects", "review_text"]
            if column in executive_reviews_df.columns
        ]
        if dedupe_columns:
            executive_reviews_df = executive_reviews_df.drop_duplicates(
                subset=dedupe_columns
            )

        evidence_parts = []
        for aspect_name in executive_reviews_df["aspects"].dropna().unique():
            aspect_rows = executive_reviews_df[
                executive_reviews_df["aspects"] == aspect_name
            ]

            if "sentiment" in aspect_rows.columns:
                evidence_parts.append(
                    aspect_rows[aspect_rows["sentiment"] == "Negative"].head(12)
                )
                evidence_parts.append(
                    aspect_rows[aspect_rows["sentiment"] == "Positive"].head(8)
                )
                evidence_parts.append(
                    aspect_rows[aspect_rows["sentiment"] == "Neutral"].head(3)
                )
            else:
                evidence_parts.append(aspect_rows.head(15))

        evidence_parts = [part for part in evidence_parts if not part.empty]
        executive_evidence_df = (
            pd.concat(evidence_parts, ignore_index=True)
            if evidence_parts
            else executive_reviews_df.head(150)
        )
    else:
        executive_evidence_df = pd.DataFrame()

    executive_review_records = []
    if not executive_evidence_df.empty:
        for _, row in executive_evidence_df.iterrows():
            evidence_text = str(row.get("review_text", "")).strip()
            if not evidence_text:
                continue
            executive_review_records.append(
                (
                    str(row.get("aspects", "")),
                    str(row.get("sentiment", "")),
                    safe_num(row.get("rating")),
                    evidence_text,
                )
            )

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    with st.container(border=True):
        section_header(
            "Executive Summary",
            "Key customer signals, strengths and areas of concern from this month's Google Play feedback.",
            "Leadership readout",
        )

        if not executive_review_records:
            st.info("Not enough written review evidence is available to build the executive summary.")
        else:
            with st.spinner("Building executive summary from customer feedback..."):
                executive_summary = generate_executive_summary(
                    month_label=parse_month_label(selected_month),
                    total_reviews_value=total_reviews,
                    avg_rating_value=avg_rating,
                    positive_pct_value=positive_pct,
                    negative_pct_value=negative_pct,
                    neutral_pct_value=neutral_pct,
                    prev_reviews_value=prev_reviews,
                    prev_rating_value=prev_rating,
                    prev_positive_value=prev_positive,
                    prev_negative_value=prev_negative,
                    aspect_stats=tuple(executive_aspect_stats),
                    review_records=tuple(executive_review_records),
                )

            st.markdown(executive_summary)


# =========================================================
# TAB 3 — REVIEW EXPLORER
# =========================================================
with reviews_tab:
    section_header(
        "Review explorer",
        "Inspect representative Google Play feedback behind the dashboard signals.",
        "Evidence layer",
    )

    if tagged_df.empty:
        st.info("No tagged reviews are available for this month.")
    else:
        filter1, filter2, filter3 = st.columns([1, 1, 1.1])

        aspect_options = sorted(
            [
                value
                for value in tagged_df.get("aspects", pd.Series(dtype=str)).dropna().astype(str).unique().tolist()
                if value.strip().lower() != "overall experience"
            ]
        )

        sentiment_options = sorted(
            tagged_df.get("sentiment", pd.Series(dtype=str)).dropna().astype(str).unique().tolist()
        )

        with filter1:
            selected_aspects = st.multiselect("Aspect", options=aspect_options)
        with filter2:
            selected_sentiments = st.multiselect("Sentiment", options=sentiment_options)
        with filter3:
            rating_range = st.slider("Rating", min_value=1, max_value=5, value=(1, 5))

        # Base actionable review set.
        base_review_df = tagged_df.copy()
        base_review_df = base_review_df[
            base_review_df.get("aspects", pd.Series(index=base_review_df.index, dtype=str))
            .astype(str)
            .str.lower()
            != "overall experience"
        ]

        # ---------------------------------------------------------
        # Aspect summary data
        # ---------------------------------------------------------
        # This dataset is filtered ONLY by aspect. The paragraph therefore
        # remains the same when sentiment or rating filters are changed.
        aspect_summary_df = base_review_df.copy()
        if selected_aspects:
            aspect_summary_df = aspect_summary_df[
                aspect_summary_df["aspects"].isin(selected_aspects)
            ]

        # ---------------------------------------------------------
        # Detailed evidence table data
        # ---------------------------------------------------------
        review_df = base_review_df.copy()

        if selected_aspects:
            review_df = review_df[review_df["aspects"].isin(selected_aspects)]
        if selected_sentiments:
            review_df = review_df[review_df["sentiment"].isin(selected_sentiments)]
        if "rating" in review_df.columns:
            review_df = review_df[
                review_df["rating"].between(
                    rating_range[0],
                    rating_range[1],
                    inclusive="both",
                )
            ]

        if "date" in review_df.columns:
            review_df = review_df.sort_values("date", ascending=False)

        # ---------------------------------------------------------
        # Gemini aspect summary — one paragraph only
        # ---------------------------------------------------------
        if len(selected_aspects) == 1:
            selected_aspect = selected_aspects[0]

            aspect_reviews = (
                aspect_summary_df.get(
                    "review_text",
                    pd.Series(dtype=str),
                )
                .dropna()
                .astype(str)
                .str.strip()
            )
            aspect_reviews = aspect_reviews[aspect_reviews != ""].drop_duplicates()

            if not aspect_reviews.empty:
                with st.spinner(f"Analysing {selected_aspect} feedback..."):
                    aspect_summary = generate_aspect_summary(
                        aspect=selected_aspect,
                        month_key=selected_month,
                        reviews=tuple(aspect_reviews.tolist()),
                    )

                safe_aspect = html.escape(str(selected_aspect))
                safe_summary = html.escape(str(aspect_summary))
                safe_month = html.escape(parse_month_label(selected_month))

                st.markdown(
                    f"""
<div class="aspect-summary-card">
    <div class="aspect-summary-kicker">Aspect summary</div>
    <div class="aspect-summary-title">{safe_aspect}</div>
    <div class="aspect-summary-meta">
        {len(aspect_reviews):,} unique reviews analysed · {safe_month}
    </div>
    <div class="aspect-summary-body">{safe_summary}</div>
</div>
                    """,
                    unsafe_allow_html=True,
                )

        elif len(selected_aspects) > 1:
            st.info("Select one aspect at a time to view its AI-generated paragraph summary.")

        st.caption(f"Showing {len(review_df):,} matched review-aspect records")

        display_columns = [
            column
            for column in ["date", "name", "rating", "sentiment", "aspects", "review_text"]
            if column in review_df.columns
        ]
        review_show = review_df[display_columns].copy()
        if "date" in review_show.columns:
            review_show["date"] = pd.to_datetime(
                review_show["date"],
                errors="coerce",
            ).dt.strftime("%d %b %Y")

        rename_map = {
            "date": "Date",
            "name": "User",
            "rating": "Rating",
            "sentiment": "Sentiment",
            "aspects": "Aspect",
            "review_text": "Review",
        }
        review_show.rename(columns=rename_map, inplace=True)

        styled_reviews = (
            review_show.head(300)
            .style
            .set_properties(
                **{
                    "background-color": "#F5F5F7",
                    "color": "#111111",
                    "border-color": "#D9D9DE",
                }
            )
            .set_table_styles(
                [
                    {
                        "selector": "th",
                        "props": [
                            ("background-color", "#E8E8EC"),
                            ("color", "#111111"),
                            ("font-weight", "700"),
                            ("border-color", "#D3D3D8"),
                        ],
                    },
                    {
                        "selector": "td",
                        "props": [
                            ("background-color", "#F7F7F9"),
                            ("color", "#111111"),
                            ("border-color", "#DEDEE3"),
                        ],
                    },
                ]
            )
        )

        st.dataframe(
            styled_reviews,
            use_container_width=True,
            hide_index=True,
            height=520,
        )

    st.markdown('<div class="spacer"></div>', unsafe_allow_html=True)

    # Coverage diagnostics
    d1, d2, d3 = st.columns(3)
    tagged_count = unique_tagged_review_count(tagged_df)
    untagged_count = len(untagged_df) if not untagged_df.empty else 0
    raw_count = len(raw_df) if not raw_df.empty else int(total_reviews or 0)

    with d1:
        insight_card("Tagged review coverage", f"{tagged_count:,} unique reviews carry at least one detected theme.")
    with d2:
        insight_card("Untagged reviews", f"{untagged_count:,} reviews did not match the current aspect dictionary.")
    with d3:
        actionable_rate = (tagged_count / raw_count * 100) if raw_count else 0
        insight_card(
            "Detected-theme rate",
            f"{actionable_rate:.1f}% of monthly reviews contain at least one detected aspect.",
            "Use this alongside the notebook's aspect coverage metric when refining regex coverage.",
        )


# =========================================================
# FOOTER
# =========================================================
st.markdown(
    """
    <div style="height: 35px;"></div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div style="
        text-align:center;
        color:#817987;
        font-size:0.8rem;
        padding: 12px 0 25px 0;
    ">
        SIMOSA Consumer Intelligence · Google Play review analytics · {parse_month_label(selected_month)}
    </div>
    """,
    unsafe_allow_html=True,
)
