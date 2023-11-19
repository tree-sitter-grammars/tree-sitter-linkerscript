/**
 * @file Linkerscript grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  PAREN_DECLARATOR: -10,
  ASSIGNMENT: -2,
  CONDITIONAL: -1,
  DEFAULT: 0,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  OFFSETOF: 8,
  SHIFT: 9,
  ADD: 10,
  MULTIPLY: 11,
  CAST: 12,
  SIZEOF: 13,
  UNARY: 14,
  CALL: 15,
  FIELD: 16,
  SUBSCRIPT: 17,
};

module.exports = grammar({
  name: 'linkerscript',

  extras: $ => [
    $.comment,
    /\s/,
  ],

  supertypes: $ => [
    $.expression,
  ],

  word: $ => $.symbol,

  rules: {
    linkerscript: $ => seq(
      optional($.entry_command),
      repeat($._command),
    ),

    entry_command: $ => seq(
      'ENTRY',
      '(',
      field('name', $.symbol),
      ')',
    ),

    _command: $ => choice(
      $.assignment,
      $.sections_command,
      $.memory_command,
      $.phdrs_command,
    ),

    sections_command: $ => seq(
      'SECTIONS',
      '{',
      repeat($._output_section_command),
      '}',
    ),

    _output_section_command: $ => choice(
      $.output_section,
      $.overlay_command,
      $.assignment,
      $.assert_command,
    ),

    output_section: $ => seq(
      choice(field('name', $.symbol), '/DISCARD/'),
      optional(field('address', $.expression)),
      optional($.section_type),
      optional(':'), // without this is discarded
      optional(alias($._at, $.load_memory_address)),
      '{',
      repeat1(seq(
        choice($.input_section, $.assignment, $.keep_command, $.provide_command),
        optional(';'),
      )),
      '}',
      optional($.region),
      optional($.lma_region),
      optional($.phdr),
      optional($.fillexp),
    ),

    _at: $ => seq('AT', '(', field('address', $.expression), ')'),

    region: $ => seq('>', $.symbol),

    lma_region: $ => seq('AT', '>', $.symbol),

    phdr: $ => seq(':', $.symbol),

    fillexp: $ => seq('=', $.expression),

    section_type: _ => seq(
      '(',
      choice('NOLOAD', 'DSECT', 'COPY', 'INFO', 'OVERLAY'),
      ')',
    ),

    input_section: $ => prec(1, seq(
      choice($.wildcard_pattern, $.filename, $.symbol),
      optional(seq(
        '(',
        repeat1(field('section', choice($.filename, $.expression, $.wildcard_pattern))),
        ')',
      )),
    )),

    wildcard_pattern: $ => seq(
      optional(seq('[', $.symbol, ']')),
      '*',
    ),

    overlay_command: $ => seq(
      'OVERLAY',
      optional(field('start', $.expression)),
      ':',
      optional('NOCROSSREFS'),
      optional($._at),
      '{',
      repeat($._output_section_command),
      '}',
      optional($.region),
      optional($.phdr),
      optional($.fillexp),
    ),

    assignment: $ => seq(
      choice($.symbol, '.'),
      choice(
        '=',
        '+=',
        '-=',
        '*=',
        '/=',
        '<<=',
        '>>=',
        '&=',
        '|=',
      ),
      $.expression,
      ';',
    ),

    assert_command: $ => seq(
      'ASSERT',
      '(',
      commaSep1($.expression),
      ')',
    ),

    keep_command: $ => seq(
      'KEEP',
      '(',
      optional($.input_section),
      ')',
    ),

    provide_command: $ => seq(
      choice('PROVIDE', 'PROVIDE_HIDDEN'),
      '(',
      $.symbol,
      '=',
      $.expression,
      ')',
      ';',
    ),

    memory_command: $ => seq(
      'MEMORY',
      '{',
      repeat($._memory),
      '}',
    ),

    _memory: $ => seq(
      field('name', $.symbol),
      optional(choice(
        seq('(', $.attributes, ')'),
        $.attributes,
      )),
      ':',
      choice('ORIGIN', 'org', 'o'), '=', field('origin', $.expression),
      ',',
      choice('LENGTH', 'len', 'l'), '=', field('length', $.expression),
    ),

    attributes: _ => repeat1(/[rwxail!]/i),

    phdrs_command: $ => seq(
      'PHDRS',
      '{',
      repeat($._phdr),
      '}',
    ),

    _phdr: $ => seq(
      field('name', $.symbol),
      field('type', $.symbol),
      optional('FILEHDR'),
      optional('PHDRS'),
      optional($._at),
      ';',
    ),

    expression: $ => choice(
      $.conditional_expression,
      $.unary_expression,
      $.binary_expression,
      $.parenthesized_expression,
      $.call_expression,
      $.symbol,
      $.quoted_symbol,
      $.number,
      '.',
    ),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $.expression),
      '?',
      optional(field('consequence', $.expression)),
      ':',
      field('alternative', $.expression),
    )),

    unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-')),
      field('argument', $.expression),
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        ));
      }));
    },

    parenthesized_expression: $ => seq('(', $.expression, ')'),

    call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.expression),
      field('arguments', $.argument_list),
    )),

    argument_list: $ => seq('(', commaSep(choice($.expression, $.input_section)), ')'),

    number: _ => token(choice(
      /0[xX][a-fA-F0-9]+/,
      /0[bB][01]+/,
      /0[0-7]+/,
      /0|[1-9][0-9]*(h|H|o|O|b|B|d|D|K|M)?/,
    )),

    symbol: _ => /[a-zA-Z_.][a-zA-Z0-9_.-]*/,

    quoted_symbol: _ => seq('"', /[^"]*/, '"'),

    filename: _ => /[^(){};=,\s]+/,

    comment: _ => token(choice(
      seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),

  },
});

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {ChoiceRule}
 *
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
