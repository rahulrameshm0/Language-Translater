# Vaylo 1.2 design

The translator is a conversation workspace, with one integrated language rail and a large writing/transcript canvas. Voice input follows an actual sequence: Speak, Review, Translate. Words appear in the canvas as recognition events arrive. Stopping exposes an editable transcript and an explicit Confirm & translate action. Nothing is translated automatically.

Tokens: porcelain #F5F7FC, white #FFFFFF, midnight ink #17233D, cobalt #2855F6, speech teal #087F78, slate #65738E. Dark uses midnight #0C1427, blue slate #17243D, pale ink #EDF3FF, and soft cobalt #A2B8FF. Cobalt marks translation actions; teal marks speech status. The existing Vaylo icon remains.

Type: native sans-serif with rounded iOS display styling, heavy 38/44 screen titles, 24/35 source and transcript text, 15/23 body, and 12/18 secondary information. Native-script fallback supports Armenian. All source and result content is left aligned.

Layout:
  compact brand                         theme
  Translate / subtitle
  [Type] [Speak]
  [English          swap           Spanish]
  [source or live transcript canvas       ]
  [microphone + Stop / Record again       ]
  [review guidance and Confirm & translate]
  [translated result and copy / listen    ]
  floating three-destination navigation

Review of the old design: separate bordered cards and a large centered microphone hid the content hierarchy. Replace them with a single language rail, a transcript-first voice surface, a clear review state, and quiet supporting account/history layouts. Use different radii for structural surfaces and small controls. No decorative waveform, fake live text, or repeating promotional headings. Keyboard-aware scrolling and light/dark palettes remain throughout.
