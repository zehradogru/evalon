import markdown
import re
import os

in_file = "/Users/aliberkyesilduman/.gemini/antigravity/brain/7169d93b-e23c-475b-b0d7-64531e4b799d/ara_rapor_backend.md"
out_html = "/Users/aliberkyesilduman/backtest/Borsa-1_Ara_Rapor.html"

with open(in_file, "r", encoding="utf-8") as f:
    text = f.read()

# Replace GitHub alerts with span classes for styling
text = text.replace("> [!NOTE]", '<div class="alert note"><strong>Bilgi:</strong>')
text = text.replace("> [!IMPORTANT]", '<div class="alert important"><strong>Önemli:</strong>')
text = text.replace("> [!WARNING]", '<div class="alert warning"><strong>Uyarı:</strong>')
# Close the div for alerts (a bit hacky but works for this specific markdown structure where alert is followed by empty lines)
text = re.sub(r'(<div class="alert [^>]+>.*?)\n\n', r'\1</div>\n\n', text, flags=re.DOTALL)

# Find mermaid code blocks and change them to div classes for Mermaid JS
text = re.sub(r'```mermaid\n(.*?)\n```', r'<div class="mermaid">\1</div>', text, flags=re.DOTALL)

html_body = markdown.markdown(text, extensions=['tables', 'fenced_code'])

# Fix the unclosed divs if any remaining due to the regex
html_body = html_body.replace('</div></p>', '</div>')

html_template = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Borsa-1 Ara Rapor</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
        
        :root {{
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --text-main: #1f2937;
            --text-light: #4b5563;
            --bg-main: #ffffff;
            --bg-alt: #f3f4f6;
            --border: #e5e7eb;
        }}

        body {{
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: var(--text-main);
            background-color: var(--bg-alt);
            margin: 0;
            padding: 2rem;
        }}

        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: var(--bg-main);
            padding: 3rem 4rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }}

        h1, h2, h3, h4 {{
            color: #111827;
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }}

        h1 {{
            font-size: 2.25rem;
            border-bottom: 3px solid var(--primary);
            padding-bottom: 0.5rem;
            text-align: center;
            margin-bottom: 2rem;
        }}

        h2 {{
            font-size: 1.75rem;
            border-bottom: 2px solid var(--border);
            padding-bottom: 0.5rem;
            color: var(--primary);
        }}

        h3 {{
            font-size: 1.25rem;
            color: #374151;
        }}

        p, li {{
            font-size: 1.05rem;
            color: var(--text-light);
        }}

        a {{
            color: var(--primary);
            text-decoration: none;
        }}
        
        a:hover {{
            text-decoration: underline;
        }}

        /* Table Styles */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            font-size: 0.95rem;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }}

        th, td {{
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }}

        th {{
            background-color: var(--bg-alt);
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 0.05em;
        }}

        tr:last-child td {{
            border-bottom: none;
        }}

        tr:hover td {{
            background-color: #f9fafb;
        }}

        /* Code Blocks */
        pre {{
            background-color: #1f2937;
            color: #f3f4f6;
            padding: 1.5rem;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Fira Code', monospace;
            font-size: 0.9rem;
            margin: 1.5rem 0;
            box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
        }}

        code {{
            background-color: var(--bg-alt);
            color: #ef4444;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: 'Fira Code', monospace;
            font-size: 0.9em;
        }}

        pre code {{
            background-color: transparent;
            color: inherit;
            padding: 0;
        }}

        /* Blockquotes */
        blockquote {{
            border-left: 4px solid var(--primary);
            background: #f0fdf4;
            margin: 1.5rem 0;
            padding: 1rem 1.5rem;
            border-radius: 0 8px 8px 0;
            color: #166534;
            font-style: italic;
        }}

        /* Alerts */
        .alert {{
            padding: 1rem 1.5rem;
            border-radius: 8px;
            margin: 1.5rem 0;
            border-left: 4px solid;
            font-size: 1rem;
        }}
        
        .alert p {{
            margin: 0;
            color: inherit;
        }}

        .alert.note {{
            background-color: #eff6ff;
            border-left-color: #3b82f6;
            color: #1e3a8a;
        }}

        .alert.important {{
            background-color: #fef2f2;
            border-left-color: #ef4444;
            color: #991b1b;
        }}

        .alert.warning {{
            background-color: #fffbeb;
            border-left-color: #f59e0b;
            color: #92400e;
        }}

        /* Mermaid Wrapper */
        .mermaid-wrapper {{
            background: white;
            padding: 2rem;
            border-radius: 8px;
            border: 1px solid var(--border);
            margin: 2rem 0;
            text-align: center;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }}

        /* Print Optimization */
        @media print {{
            body {{
                background: none;
                padding: 0;
            }}
            .container {{
                box-shadow: none;
                padding: 0;
                max-width: 100%;
            }}
            pre {{
                border: 1px solid #d1d5db;
                white-space: pre-wrap;
            }}
            .mermaid-wrapper {{
                page-break-inside: avoid;
            }}
            table {{
                page-break-inside: avoid;
            }}
        }}
    </style>
    <!-- Mermaid.js for UML ->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{ 
            startOnLoad: true, 
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        }});
    </script>
</head>
<body>
    <div class="container">
        {html_body.replace('<div class="mermaid">', '<div class="mermaid-wrapper"><div class="mermaid">').replace('</div>', '</div></div>')}
    </div>
    
    <script>
        // Clean up any weird nested wrappers caused by simple regex
        document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {{
            if(wrapper.innerHTML.includes('<div class="mermaid-wrapper">')) {{
                wrapper.outerHTML = wrapper.innerHTML;
            }}
        }});
    </script>
</body>
</html>
"""

# Small cleanup since string replacement might wrap unrelated divs.
html_template = html_template.replace('</div></div></p>', '</div>')

with open(out_html, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"Rapor oluşturuldu: {{out_html}}")
